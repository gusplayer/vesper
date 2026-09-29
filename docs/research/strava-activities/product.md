# Actividades de Strava en hábitos y retos: días, no kilómetros

Informe de producto · 2026-09-29 · sin cambios al repo

## Resumen

Sí, y sin conectar Strava. **La recomendación es leer el tipo de entrenamiento que ya llega
a Salud (y a Health Connect) y contar días, nunca cifras.** Strava escribe sus actividades
en Salud si el usuario lo activa, y lo mismo hacen el Apple Watch, Garmin, Fitbit y
Samsung. Vesper ya pide leer entrenamientos: le falta mirar de qué tipo son.

La versión mínima tiene cuatro piezas. El tipo se lee del nombre, como la meta de pasos
(ADR-0042): "Montar en bici" cuenta solo salidas en bici y "Hacer ejercicio" cuenta
cualquier entrenamiento. Las veces por semana pasan a ser de 1 a 6 en hábitos y retos. Una
hoja explica cómo hacer que Strava o Garmin lleguen a Salud. Y el círculo ve qué días
cumpliste, nunca distancia, ritmo, tiempo ni ruta. No hace falta backend, permiso nuevo ni
migración. "Conectar con Strava" queda afuera: cubre a menos gente, pide una cuenta y un
servidor, y los términos de Strava prohíben mostrar sus datos a otra persona, que es
justo lo que hace un reto.

## 1. El trabajo que se contrata

**Quién lo pide.** Alguien que ya se mueve y ya lo registra: sale en bici el fin de semana
y lo sube a Strava, corre con un Garmin o va al gimnasio con el Apple Watch. No busca una
app de ejercicio, porque ya tiene una. Busca que su promesa de moverse viva al lado de las
otras (leer, dormir, soltar el teléfono) y que su círculo la vea.

**Qué quiere, en orden:**
1. **Que cuente lo que ya hace, sin anotarlo dos veces.** Si marcar a mano una salida que
   ya grabó le cuesta un toque, lo va a olvidar, y el reto se va a leer peor de lo que fue.
2. **No mentirse.** "Tres veces por semana" sin registro se estira sola. El reloj no negocia.
3. **Compañía sin competencia.** "Rodar juntos dos veces por semana" con dos amigos, sin
   saber quién hizo más kilómetros.

**Cómo sirve a la tesis de Vesper.** Vesper mide el tiempo que asignas a lo que elegiste,
no tu rendimiento. El PRD ya pone el entrenamiento en la moneda verificada ("gym, pasos,
sueño"). Una salida en bici es tiempo lejos de la pantalla que un reloj confirma: es el
libro mayor del día en su mejor versión. La línea que no se cruza es esta: **Vesper
cuenta que fuiste, no cuánto rendiste.** Los minutos son la moneda de Vesper. Los
kilómetros, el ritmo y la ruta son de Strava.

**Riesgos y su guardarraíl:**

| Riesgo | Cómo se vería | Guardarraíl |
|---|---|---|
| Volverse app de fitness | Pedir kilómetros, ritmo, mapas, zonas | Días, no cifras. Un mínimo fijo de 10 minutos. Vesper nunca lee la ruta |
| Presión y obsesión | 7 de 7 sin descanso, "5 de 3" celebrado | Tope de 6 por semana. Pasar la meta se lee "Cumpliste" y nada más |
| Ansiedad de racha | Una cadena de entrenos que se rompe | La meta es semanal y trae holgura. No hay racha nueva (ADR-0027) |
| Comparar rendimiento | "Ana 80 km · tú 20 km" | El círculo ve días y el origen ("con Salud"), nunca cifras ni la app |
| Avisos | "Detectamos tu salida en bici" | Ningún aviso nuevo. La marca aparece en silencio |
| El verificado vacío | Elegir "verificado" sin reloj ni app: cero toda la semana | Declarado sigue por defecto y la tarjeta dice que hace falta registrar |
| Retraso | El círculo no ve tu salida hasta que abres Vesper, y alguien te empuja | Decisión abierta, §7 |

## 2. Qué hace el mercado

**Pantallas (Mobbin):**
- **Streaks, "Add Task" de Salud** ([pantalla](https://mobbin.com/screens/9eef1436-2612-4c89-8e49-72f058d54533)):
  "Walk or Run", "Cycle", "Swim"… y la frase "se marcan solas cuando se registran datos
  nuevos". Es lo más cercano a la propuesta: el tipo es parte del hábito. No se copian el
  color por tarea ni la racha diaria.
- **adidas Running, "Add goal"** ([pantalla](https://mobbin.com/screens/c4391918-7091-4970-bd1d-f648733aaeaa)):
  "All sports · All tracked activities count", Running, Walking, Hiking, Cycling; por
  semana; meta de actividades o de duración. Nuestras familias son esta lista, más corta.
- **Fitbit, "Exercise days"** ([pantalla](https://mobbin.com/screens/0d35d5a3-e05f-4e21-866a-06c8d4419858)):
  "6 días por semana". Fitbit cuenta días con un entrenamiento, no entrenamientos, de 1 a
  7, y 5 por defecto. Es la unidad que Vesper ya usa.
- **Strava, "Add a New Goal"** ([pantalla](https://mobbin.com/screens/fc875790-cdcc-4d9e-89e2-dea5aacba8ec)):
  deporte, semanal, y cuatro tipos (actividades, distancia, tiempo, desnivel). Su meta es
  volumen. De ahí solo sirve "actividades", convertido en días.
- **Strava, reto de grupo** ([pantalla](https://mobbin.com/screens/d843978d-e1ed-4b95-94de-704ec95e37f2)):
  "¿Qué deportes cuentan?" con más de doce casillas. Sus retos de grupo son tablas de
  quién sumó más tiempo, distancia o desnivel, o quién fue más rápido. Es el antipatrón
  doble: la lista larga y la tabla.
- **Strava, Salud** ([ajustes](https://mobbin.com/screens/1170112c-0f88-4198-b57a-5115fa06f3a8),
  [estado](https://mobbin.com/screens/3e456518-e5ce-487c-92a6-e233b73c29cb),
  [conectar](https://mobbin.com/screens/ee4cda1a-85b0-4b00-bc39-6898a3772a19)):
  "Conecta con Salud para importar entrenamientos de Apple y enviar tus actividades de
  Strava a Salud". Es la pantalla a la que vamos a mandar a la gente.

**Productos:**
- **Apple Fitness y Garmin Connect.** Apple compite de a dos durante 7 días, a puntos, avisa
  si vas adelante o atrás y premia con insignias. Garmin tiene metas por tipo, pero también
  insignias con puntos y una tabla entre conexiones. De ahí sirve la meta; nada más.
- **Strava.** Ya tiene "semanas seguidas" (cualquier subida de 60 segundos o más, incluso a
  mano, con banderas y stickers). Vesper no necesita otra racha de ejercicio: su valor es
  la promesa con doce personas, mezclada con leer y dormir.
- **Habitify.** Conecta Strava directo y marca carreras, bici y nado. El costo se ve en un
  sincronizador de terceros: si Strava rechaza el token, queda en "hay que volver a autorizar".

**El hueco.** Nadie junta "N días por semana de un tipo, contado solo" con un grupo chico y
sin tabla. Strava rankea volumen, Apple compite a puntos, y Fitbit y adidas cuentan días
pero a solas.

## 3. Encaje con lo escrito

| Regla / ADR | Qué toca | ¿Sin enmienda? |
|---|---|---|
| **4** Máximo 5 hábitos | Un hábito de bici ocupa un lugar. "Hacer ejercicio" y "Montar en bici" son dos, y una salida en bici marca los dos ese día | Sí |
| **7** Local-first | Por Salud, nada nuevo sale del teléfono. Strava directo pide un servidor que guarde el secreto y renueve tokens | Salud: sí. Strava: ADR |
| **8** Permisos | Vesper ya pide leer entrenamientos (`Workout` en iOS, `ExerciseSession` en Health Connect). No hay hoja nueva | Sí |
| **9** + ADR-0005 | Se cuentan días. Cada marca guarda su origen y la semana se dice por la menos verificada (ADR-0042 §4) | Sí |
| **11** Círculo | El círculo ve días. El tipo solo se sabe por el nombre del reto, que ya es de todos. Nunca la app ni el reloj | Sí |
| **ADR-0008 / 0041** | El nombre decide la familia. Un nombre que no nombra un deporte cuenta cualquier entrenamiento; uno que nada reconoce cae a declarado, como hoy | Sí |
| **ADR-0042** | Mismo patrón que `stepGoalFor`: la regla va en el nombre, así que todos en el reto cuentan lo mismo. Cambia el reto sugerido "Moverte" | Sí |
| **ADR-0027** | Ningún aviso nuevo. El de reto en riesgo sirve igual con meta 1 (llega el domingo) | Sí |
| **PRD, Hábitos** | "2× / 4× / 6×, sin valor custom en fase 1" pasa a 1–6. Y `CHALLENGE_TARGET_OPTIONS` pasa de 2–6 a 1–6 | ADR |
| **ADR-0051** | "Fotos del día" encendida en los retos de ejercicio: la foto de la vista, nunca el mapa | Sí |
| **ADR-0046** | Por Salud, las etiquetas de privacidad no cambian. Strava directo suma un tercero a la política | Salud: sí |

Un cambio de comportamiento que hay que decir: **hoy un hábito "Bici" cuenta cualquier
entrenamiento.** Con esto contaría solo salidas en bici. La línea bajo el nombre lo dice en
el editor. Como la app no está en tiendas, nadie lo sufre todavía.

## 4. Strava directo o Salud, desde los ojos del usuario

| | Por Salud / Health Connect | "Conectar con Strava" |
|---|---|---|
| A quién cubre | Apple Watch, Garmin, Fitbit y Pixel, Samsung, Zwift en el iPhone, y Strava con "Enviar a Salud" | Solo a quien sube todo a Strava |
| Qué le pide | El permiso de Salud, que ya incluye entrenamientos | Una cuenta de Strava, un login en el navegador y autorizar a Vesper |
| Qué ve Vesper | Que hubo un entrenamiento, su tipo, inicio y fin | Lo que dé el alcance: tipo, distancia, ritmo y la ruta con su punto de partida |
| Qué puede ver el círculo | Días, como hoy | Según Strava, sus datos solo se muestran a esa persona. El reto queda en duda |
| Servidor | Ninguno | Uno para el secreto de cliente y la renovación de tokens (regla 7) |
| Cómo falla | Lee al abrir la app | Token vencido, "vuelve a conectar Strava", límites y revisión de la API |
| Cuánto hay que explicar | "Llega de Salud" | Qué lee, por qué, cómo desconectar, qué pasa con tus rutas |

**Salud es más claro y cubre a más gente.** Quien tiene un Apple Watch o un Garmin y nunca
abre Strava queda cubierto sin hacer nada (o con un interruptor en Garmin). Quien usa
Strava en el iPhone activa "Enviar a Salud" una vez. Y un día no se duplica aunque el reloj
y Strava escriban la misma salida: son dos entrenamientos, pero es un solo día.

**El costo de confianza de "Conectar con Strava" es alto para lo que resuelve.** Una app que
presume de no tener login le pediría a la gente una cuenta ajena y permiso para leer sus
rutas, que empiezan en su casa, solo para saber si salió el martes. Salud deja pedir
exactamente "entrenamientos", sin rutas: son permisos separados.

**El único que Salud deja afuera:** en Android, Strava solo pasa a Health Connect las
actividades con GPS. Una salida en rodillo grabada solo en Strava (Zwift en un computador,
por ejemplo) no llega. Ese usuario marca a mano, y su línea dice "marcado a mano". Es un
caso chico y no justifica una cuenta, un servidor ni un término que bloquea al círculo.

**Cómo hablarle al usuario de Strava.** Sin prometer lo que no hacemos: "Vesper no se conecta
a tus apps: lee los entrenamientos que dejan en Salud." Y la ruta exacta en una hoja (§6.3;
el texto, en §6.5). Estado de cada ruta:
- **Strava** en iPhone (*You › Settings › Manage Apps and Devices › Health › Send to
  Health*) y en Android (*… › Health Connect*, solo actividades con GPS): confirmadas en
  inglés por el soporte de Strava. Sus etiquetas en español, **sin confirmar**.
- **Garmin Connect** en iPhone (*More › Settings › Connected Apps › Apple Health*): **sin
  confirmar**, la dan guías de terceros. En Android escribe en Health Connect desde
  mediados de 2025, con entrenamientos; su ruta, **sin confirmar**.
- **Apple Watch:** nada que hacer.

Lo que falta verificar antes de escribir el ADR (le toca al informe técnico de Salud en esta
carpeta): que el tipo llegue en las dos plataformas (`activityName` en iOS, `exerciseType`
en Health Connect), que Strava en iOS pase también lo que le llega de Garmin o Zwift (su
soporte dice que esas llegan "sin la ruta", lo que sugiere que sí), y cómo marca Salud un
entrenamiento tecleado a mano.

## 5. Escenarios

| Escenario | Qué configura | Qué ve en la semana | Qué ve el círculo |
|---|---|---|---|
| **"Ejercicio 3 veces por semana"** | `habits/new`: "Hacer ejercicio", chip 3, Verificado. La línea: "Cuenta los días con un entrenamiento de 10 minutos o más, del tipo que sea." | "2 de 3 · verificado por Salud". Dos entrenos el mismo día cuentan uno | Si comparte hábitos: sus hábitos hechos y prometidos de la semana, como hoy. Nada del tipo |
| **"Bici 1 día a la semana"** | "Montar en bici", chip 1, Verificado. La línea dice "salida en bici" | "0 de 1" hasta la salida. Una carrera no la marca | Igual que arriba |
| **Reto "Rodar juntos 2 veces por semana"** | `circle/challenge-new`: el nombre lee bici; encima de "Crear reto", el consentimiento. Cada quien se une y su teléfono cuenta lo mismo, porque el nombre es el mismo | La grilla del reto con sus días; el aviso de reto en riesgo si toca | Los días de cada quien y "con Salud" o "marcado a mano". Nunca distancia, tiempo ni ruta |
| **Registra en Strava (iPhone)** | Al elegir Verificado, la fila "¿Registras en Strava o Garmin?" abre la hoja; activa "Enviar a Salud" una vez | Sus salidas marcan solas desde ese día (solo las nuevas, según Strava) | "con Salud". Nunca "con Strava" |
| **Apple Watch, sin Strava** | Nada más que Verificado | Lo que graba en el reloj marca solo | "con Salud" |
| **Android con Garmin** | Activa Health Connect en Garmin Connect; Vesper ya lee Health Connect (ADR-0043) | Marca solo | "con Salud" |
| **Sin nada** | Declarado (el defecto). Si elige Verificado, la tarjeta le dice que hace falta un reloj o una app | Toca el día para marcarlo | "marcado a mano". Cuenta igual |

## 6. Propuesta

### 6.1 Qué cuenta: la familia va en el nombre

El tipo no es un hábito nuevo ni un selector nuevo. Es una propiedad del hábito que se lee
del nombre, como la meta de pasos y las horas de sueño. `healthType` sigue siendo
`'workout'`, y la familia se deriva al leer, sin columna nueva ni migración.

| Familia | Palabras en el nombre (es · en) | Qué cuenta |
|---|---|---|
| Cualquier entrenamiento | ejercicio, entrenar, gym, gimnasio, pesas · exercise, workout, train, gym | Todo entrenamiento de 10 min o más |
| Bici | bici, cicla, ciclismo, rodar, pedalear, spinning, MTB · bike, cycling, ride, spin | Bici al aire libre y en interior |
| Correr | correr, trotar · run, jog | Carrera al aire libre y en cinta |
| Nadar | nadar, natación · swim | Piscina y aguas abiertas |
| Caminar (ya existe) | caminar, pasos, senderismo · walk, steps, hike | Pasos del día (ADR-0042), sin cambio |

Por qué el nombre y no un selector:
- **El reto lo trae gratis.** El nombre ya viaja y es el mismo para todos. Un selector
  obliga a guardar el tipo en `challenges`, en el servidor y en el sync.
- **Es la regla que ya existe.** ADR-0008, 0041 y 0042 definen el hábito por su nombre, y
  dos veces rechazaron un selector en la pantalla más simple de la app.
- **La lista larga es el antipatrón.** Cuatro familias se leen en una línea; setenta tipos
  de HealthKit en casillas son el reto de grupo de Strava.
- **Lo que falla se ve.** La línea bajo el nombre dice qué se leyó mientras escribes, y
  sumar palabras a la tabla es aditivo.

Los deportes sin familia (yoga, fútbol, tenis, pádel, crossfit, remo) quedan como hoy:
declarados. Se suman después si alguien los pide (§8).

Se cuentan **días, no entrenamientos**. Es la unidad de los hábitos (`day_key`), vuelve
inofensivos los duplicados reloj + Strava, y no premia entrenar dos veces el mismo día.

### 6.2 Veces por semana: de 1 a 6, iguales en hábitos y retos

Una sola lista, `1 · 2 · 3 · 4 · 5 · 6`, en el editor de hábitos y en "Nuevo reto". El 1
responde "bici un día a la semana". El 3 y el 5 dejan de ser metas que solo nacen de un
reto (hoy `targetOptions` las rescata a mano). **El 7 no se ofrece:** siete de siete es
una racha con otro nombre, y el descanso es parte de entrenar. Seis pastillas de un dígito
caben en una fila.

### 6.3 En el editor de hábitos

La tarjeta "Verificado" de un nombre de ejercicio dice "Salud lo confirma si registras con
un reloj o una app". Debajo de las tarjetas, la línea de la familia (hermana de la de pasos)
y, con Verificado elegido, una fila que abre la hoja "Que llegue a Salud". La misma hoja se
abre desde Ajustes › Salud.

```
 habits/new                        Hoja (iPhone)
┌──────────────────────────┐      ┌──────────────────────────┐
│ ‹      Nuevo hábito      │      │ Que llegue a Salud     ✕ │
│ Nombre                   │      │ Vesper no se conecta a   │
│ Montar en bici           │      │ tus apps: lee los entre- │
│ Veces por semana         │      │ namientos que dejan en   │
│ (1)(2)(3)(4)(5)(6)       │      │ Salud. Nunca la ruta.    │
│ Cómo se cuenta           │      │┌────────────────────────┐│
│ ○ Declarado              │      ││ Apple Watch            ││
│   Lo marcas tú           │      ││ Nada que hacer.        ││
│ ● Verificado             │      ││ Strava                 ││
│   Salud lo confirma si   │      ││ Tú › Ajustes › Admi-   ││
│   registras con un reloj │      ││ nistrar aplicaciones y ││
│   o una app              │      ││ dispositivos › Salud › ││
│ Salud está conectada…    │      ││ Enviar a Salud         ││
│ Cuenta los días con una  │      ││ Garmin Connect         ││
│ salida en bici de 10 min │      ││ Más › Configuración ›  ││
│ o más, al aire libre o   │      ││ Aplicaciones conectadas││
│ en interior.             │      │└────────────────────────┘│
│┌────────────────────────┐│      │ ¿No aparece? Mira si está│
││¿Registras en Strava   ›││      │ en Salud. Si está y no   │
││ o Garmin?              ││      │ cuenta, duró menos de 10 │
│└────────────────────────┘│      │ minutos o es de otro     │
│┌────────────────────────┐│      │ tipo.                    │
││        Guardar         ││      │                          │
│└────────────────────────┘│      │                          │
└──────────────────────────┘      └──────────────────────────┘
```

La hoja es una `Sheet` con un `ListGroup` de filas de dos líneas, sin botón primario (la
pantalla de atrás ya tiene el suyo). En Android cambia las rutas y suma la nota de GPS.
Componentes nuevos: ninguno.

### 6.4 En "Nuevo reto" y en el reto

La misma línea de familia bajo el nombre y el consentimiento de ADR-0042 §5, con la
familia dicha. Los sugeridos cambian: **"Moverte" pasa a "Hacer ejercicio"** (3 veces por
semana, 4 semanas), que hoy no mapea a nada y queda declarado, y se suma **"Montar en
bici"** (1 vez por semana, 4 semanas). Los dos con "Fotos del día" encendida.

```
 circle/challenge-new              circle/challenge (miércoles)
┌──────────────────────────┐      ┌──────────────────────────┐
│ ‹       Nuevo reto       │      │ ‹      Rodar juntos      │
│ Nombre                   │      │ Quedan 26 días           │
│ Rodar juntos             │      │ 2 veces por semana ·     │
│ Cuenta los días con una  │      │ 4 semanas · con Ana, Luis│
│ salida en bici de 10 min │      │  L  M  M  J  V  S  D     │
│ o más, al aire libre o   │      │ [■][ ][ ][ ][ ][ ][ ]    │
│ en interior.             │      │ Te falta 1 · quedan 5    │
│ Retos sugeridos          │      │ días                     │
│ (Montar en bici)(Hacer   │      │ Esta semana              │
│  ejercicio)(Leer) …      │      │ Ana           2 de 2  ✓  │
│ Veces por semana         │      │ con Salud                │
│ (1)(2)(3)(4)(5)(6)       │      │ [■][■][ ][ ][ ][ ][ ]    │
│ Cuánto dura … Fotos del  │      │ Luis          1 de 2     │
│ día · Con quién …        │      │ marcado a mano           │
│ Tu círculo verá qué días │      │ [■][ ][ ][ ][ ][ ][ ]    │
│ saliste en bici. No verá │      │ (Empujar)                │
│ distancia, tiempo ni ruta│      │ Salud marca este reto    │
│┌────────────────────────┐│      │ sola. No tienes que      │
││       Crear reto       ││      │ tocar nada.              │
│└────────────────────────┘│      │                          │
└──────────────────────────┘      └──────────────────────────┘
```

Lo que el reto **no** muestra: minutos, kilómetros, ritmo, la hora de la salida ni la app
que la grabó. La línea de origen sigue diciendo "con Salud", aunque Salud sepa que vino de
Strava: nombrar la app invita a comparar equipos y dice qué reloj tiene cada quien.

### 6.5 Copy

| Pieza | Español | English |
|---|---|---|
| Placeholder del hábito | gym, bici, leer, dormir 7h | gym, bike, read, sleep 7h |
| Placeholder del reto | leer, bici, dormir 7h | read, bike, sleep 7h |
| Tarjeta Verificado, ejercicio | Salud lo confirma si registras con un reloj o una app | Health confirms it if you record with a watch or an app |
| Línea, cualquiera | Cuenta los días con un entrenamiento de 10 minutos o más, del tipo que sea. | Counts the days with a workout of 10 minutes or more, of any kind. |
| Línea, bici | Cuenta los días con una salida en bici de 10 minutos o más, al aire libre o en interior. | Counts the days with a bike ride of 10 minutes or more, outdoors or indoors. |
| Línea, correr | Cuenta los días que corres 10 minutos o más, al aire libre o en cinta. | Counts the days you run for 10 minutes or more, outdoors or on a treadmill. |
| Línea, nadar | Cuenta los días que nadas 10 minutos o más. | Counts the days you swim for 10 minutes or more. |
| Fila de ayuda | ¿Registras en Strava o Garmin? | Do you record on Strava or Garmin? |
| Fila en Ajustes › Salud | Que tus apps lleguen a Salud | Get your apps into Health |
| Hoja, título | Que llegue a Salud | Getting it into Health |
| Hoja, entrada | Vesper no se conecta a tus apps: lee los entrenamientos que dejan en Salud. Nunca la ruta. | Vesper does not connect to your apps: it reads the workouts they leave in Health. Never the route. |
| Apple Watch | Nada que hacer: lo que registras en el reloj ya está en Salud. | Nothing to do: what you record on the watch is already in Health. |
| Strava, iPhone | Tú › Ajustes › Administrar aplicaciones y dispositivos › Salud › Enviar a Salud. | You › Settings › Manage Apps and Devices › Health › Send to Health. |
| Strava, Android | Tú › Ajustes › Administrar aplicaciones y dispositivos › Health Connect. Solo pasan las actividades con GPS. | You › Settings › Manage Apps and Devices › Health Connect. Only GPS activities go through. |
| Garmin, iPhone | Más › Configuración › Aplicaciones conectadas › Apple Health. | More › Settings › Connected Apps › Apple Health. |
| Garmin, Android | En Garmin Connect, activa Health Connect entre las apps conectadas. | In Garmin Connect, turn on Health Connect under connected apps. |
| Hoja, pie | ¿No aparece? Mira si está en Salud. Si está y no cuenta, duró menos de 10 minutos o es de otro tipo. | Not showing up? Check whether it is in Health. If it is and does not count, it was shorter than 10 minutes or of another kind. |
| Consentimiento, cualquiera | Tu círculo verá qué días entrenaste. No verá qué hiciste, cuánto ni dónde. | Your circle will see which days you trained. Not what you did, how much or where. |
| Consentimiento, bici | Tu círculo verá qué días saliste en bici. No verá distancia, tiempo ni ruta. | Your circle will see which days you rode. Not the distance, the time or the route. |
| Consentimiento, correr | Tu círculo verá qué días corriste. No verá distancia, ritmo ni ruta. | Your circle will see which days you ran. Not the distance, the pace or the route. |
| Consentimiento, nadar | Tu círculo verá qué días nadaste. No verá cuánto ni dónde. | Your circle will see which days you swam. Not how far or where. |
| Sugeridos | Hacer ejercicio · Montar en bici | Exercise · Ride a bike |

Las rutas en español de Strava y Garmin se copian de las apps antes de publicar; las de la
tabla son una traducción (§4).

### 6.6 Lo que no se construye

- Distancia, ritmo, velocidad, desnivel, calorías, pulso o zonas, ni para ti ni para el
  círculo. Mapas, rutas o el punto de partida: Vesper no pide el permiso de rutas.
- Kudos, comentarios, reacciones o un feed de actividades ("Ana acaba de rodar").
- Tablas, "quién hizo más", retos de volumen al estilo Strava, puntos o insignias.
- Un aviso por actividad detectada. Escribir en Salud o publicar en Strava.
- Planes, carga o recuperación. Siete de siete, o celebrar pasar la meta.
- "Conectar con Strava" en esta versión.

## 7. Decisiones abiertas

1. **El reloj olvidado.** Hoy un hábito verificado no se marca a mano (ADR-0041; el aviso
   dice "Lo marca Salud. Para marcarlo tú, cámbialo a declarado"). Con ejercicio pasa
   seguido: saliste en bici con el reloj cargando y el día se pierde, o pasas todo el hábito
   a declarado. **Recomendación:** marcar a mano hoy o ayer un hábito verificado, con origen
   `manual`; la semana se lee "marcado a mano", porque decide la marca menos verificada
   (ADR-0042 §4). Copy: "Marcar a mano hoy · Se verá como marcado a mano." / "Mark today by
   hand · It shows as marked by hand." Enmienda un supuesto de ADR-0041. A la inversa, un
   entrenamiento que Salud dice tecleado a mano cuenta como `manual` (por confirmar en lo
   técnico). Espejo, no juez: no se acusa, se dice de dónde vino.
2. **El retraso.** Salud se lee al abrir la app (`useHealthSync`, con `AppState`). Si Luis
   salió pero no abrió Vesper, el círculo no ve su día, y Ana puede empujarlo por algo que
   sí hizo. Ya pasa con los retos de pasos, pero con una salida se nota más. Dos salidas: la
   lectura en segundo plano, o que el empujón, que ya llega como push silencioso y el
   teléfono compone (ADR-0037), lea Salud antes de mostrarse y se calle si el día ya
   cuenta. Ojo: en iOS, Salud no se lee con el teléfono bloqueado. Le toca al informe
   técnico.
3. **Qué hacer con "Gym".** Hoy cuenta cualquier entrenamiento, y así se queda. Una familia
   "fuerza" que no cuente una carrera es más fiel, pero excluye la elíptica del gimnasio.
   Se decide con uso real.

## 8. Después, si hace falta

- **Minutos en el nombre**: "Correr 30 min", como "Dormir 7,5 h". Es tiempo, la moneda de
  Vesper. La distancia, nunca: es rendimiento y es de Strava.
- **Más familias**: yoga, fuerza, fútbol, tenis, pádel, remo, elíptica. Solo palabras.
- **La salida en el libro mayor** como tiempo verificado ("2 h en bici" en Actividad ›
  Hoy), que ADR-0038 dejó esperando. Ahí la tesis de asignar tiempo se ve completa.
- **Un diagnóstico** en Ajustes › Salud ("Entrenamientos 3 · 2 de bici") para contestar
  "¿por qué no contó?" sin soporte.
- **Strava directo**, solo con tres condiciones a la vez: gente real del círculo que Salud
  no alcanza (Android y rodillo), un ADR de backend para los tokens, y un sí escrito de
  Strava a mostrar días a otras personas.

## Fuentes

**Mobbin:**
[Streaks, tarea de Salud](https://mobbin.com/screens/9eef1436-2612-4c89-8e49-72f058d54533) ·
[adidas Running, meta por deporte](https://mobbin.com/screens/c4391918-7091-4970-bd1d-f648733aaeaa) ·
[Fitbit, días de ejercicio](https://mobbin.com/screens/0d35d5a3-e05f-4e21-866a-06c8d4419858) ·
[Strava, nueva meta](https://mobbin.com/screens/fc875790-cdcc-4d9e-89e2-dea5aacba8ec) ·
[Strava, deportes de un reto](https://mobbin.com/screens/d843978d-e1ed-4b95-94de-704ec95e37f2) ·
[Strava, ajustes](https://mobbin.com/screens/1170112c-0f88-4198-b57a-5115fa06f3a8) ·
[Strava, Salud](https://mobbin.com/screens/3e456518-e5ce-487c-92a6-e233b73c29cb) ·
[Strava, conectar con Salud](https://mobbin.com/screens/ee4cda1a-85b0-4b00-bc39-6898a3772a19)

**Strava:**
[Apple Health and Strava](https://support.strava.com/en-us/articles/15402024-apple-health-and-strava) ·
[Syncing Strava Activities with Health Connect](https://support.strava.com/hc/en-us/articles/43440435267597-Syncing-Strava-Activities-with-Health-Connect) ·
[Streaks on Strava](https://support.strava.com/en-us/articles/15401580-streaks-on-strava) ·
[Group Challenges](https://support.strava.com/en-us/articles/15401736-how-do-group-challenges-work-on-strava) ·
[DC Rainmaker, los cambios de la API (2024)](https://www.dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html) ·
[road.cc, no compartir datos con otros](https://road.cc/content/news/strava-users-cant-publicly-share-data-third-party-apps-311329) ·
[appsforstrava, cambios del programa 2026 (tercero, por confirmar)](https://appsforstrava.com/blog/strava-developer-program-changes-2026)

**Otras apps:**
[Garmin y Health Connect (Android Central)](https://www.androidcentral.com/wearables/garmin/heres-everything-garmin-will-and-wont-share-with-google-health-connect) ·
[Garmin y Apple Health (guía de terceros)](https://www.sonarhealth.co/blog/sync-garmin-with-apple-health/) ·
[Zwift y Apple Health (foro de Zwift)](https://forums.zwift.com/t/sync-zwift-activities-to-apple-health/579940) ·
[Fitbit, días de ejercicio (comunidad)](https://community.fitbit.com/t5/Other-Charge-Trackers/Days-of-Exercise-per-week/td-p/3837329?nobounce) ·
[Apple Watch, compartir y competir](https://support.apple.com/guide/watch/share-your-activity-apd68a69f5c7/watchos) ·
[Garmin Connect Challenges](https://www.garmin.com/en-US/blog/general/garmin-connect-challenges/) ·
[Habitify en App Store](https://apps.apple.com/us/app/habitify-habit-tracker/id1111447047) ·
[habitify-sync, estado "auth_needed" con Strava](https://github.com/intisy/habitify-sync)

**En el repo:** `CLAUDE.md`; `docs/PRD.md`; ADR-0005, 0008, 0021, 0027, 0031, 0037, 0038,
0041, 0042, 0043, 0051; `src/domain/{habits,healthMarks,types}.ts`;
`src/platform/health.ios.ts` (`activityName` llega y no se lee); `useHealthSync.ts`;
`src/data/challenges.ts`; `challenge-new.tsx`; `HabitForm.tsx`; `src/i18n/{es,en}`.
