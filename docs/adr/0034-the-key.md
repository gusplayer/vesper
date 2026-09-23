# ADR-0034 — La llave: una sesión que abre y cierra otra persona

**Estado:** aceptada · 2026-09-22 · reabre el ADR-0021 (la decisión de no tener cámara)
y se apoya en el ADR-0025 y el ADR-0033. La llave en una página web es el ADR-0035.

## Contexto

El dueño del producto pidió un Brick virtual: en vez de un tag NFC pegado a la nevera,
un código visual que se muestra en otro dispositivo —otro teléfono o una página web— y
que hay que escanear para empezar una sesión y volver a escanear para terminarla. El
caso que describió es su casa: su hijo empieza su hora de lectura, escanea el código en
el teléfono del padre, y no puede salir hasta volver a escanearlo. Pidió además poder
ver la sesión del hijo —cuánto duró, si intentó abrir una red— y que el hijo entre a su
círculo para poder verla.

Son tres cosas distintas y conviene separarlas antes de decidir: **el mecanismo** (un
código que abre y cierra), **la llave en manos de otro** (quién puede terminar la
sesión) y **la visibilidad** (qué ve quien tiene la llave). La primera es trabajo, la
segunda es producto nuevo y la tercera es la que choca con lo que la app ya prometió.

Lo que encontramos al revisar el árbol:

1. **"No puedes terminar esto tú" ya existe: es `depth: 'deep'`.** `canGiveUp` devuelve
   false (`src/domain/session.ts:65`), `exitStepsFor` devuelve `[]`
   (`src/domain/exitRitual.ts:102`) y la pantalla activa no dibuja pie
   (`src/app/session/active.tsx:165`). Lo único que termina una sesión profunda es el
   timer o la emergencia. La llave no inventa un estado nuevo: le agrega una salida.
2. **Arrancar una sesión desde fuera ya tiene precedente.** El motor de rutinas es un
   hook de `src/platform/hooks/` que llama `focus.start(...)` y deja que `SessionGate`
   navegue (`useRoutineSync.ts:27`). Un escaneo haría lo mismo.
3. **No hay cámara, y no es un olvido.** El ADR-0021 lo decidió por escrito: "El QR
   codifica ese link. La cámara nativa del teléfono lo abre en Vesper, así que **no hay
   escáner dentro de la app ni permiso de cámara**". No hay paquete, ni permiso en
   `app.json`, ni módulo en `src/platform/`, y `CapabilityName` es una unión cerrada
   (`src/platform/capabilities.ts:19`).
4. **Un código estático se derrota con una foto.** Si la llave es un patrón fijo, quien
   la escanea le toma captura y abre cuando quiera. La llave tiene que cambiar con el
   tiempo.
5. **El código no puede llevar información en su movimiento.** La regla 6 solo permite
   animar opacidad, y con "Reducir movimiento" todo componente animado salta a su
   estado final (`src/design/useReduceMotion.ts:12`). Cualquier código tiene que ser
   legible en un solo fotograma. Una nube de partículas al estilo de Apple, con puntos
   que se desplazan, está fuera de la regla 6.
6. **Para dibujar no falta nada.** `react-native-svg` ya es dependencia, `src/lib/qr.ts`
   es un codificador propio con Reed-Solomon (byte, nivel M, versiones 1 a 5), `qrPath`
   convierte la matriz en un path, y `src/lib/dissolve.ts` ya genera campos de puntos.
   Lo único que no existe es la mitad de leer.
7. **Lo que se pidió ver está prohibido en tres sitios distintos.** Los intentos de
   abrir una app bloqueada no se registran en ninguna tabla y no pueden registrarse en
   iOS: el token de Screen Time es opaco y resolverlo a un nombre es motivo de rechazo
   (regla 10, ADR-0004). El ADR-0033, aceptado hoy, dice qué no sale nunca del teléfono:
   "sesiones, intenciones, modos, apps, sitios, nada de Tiempo de uso". Y la ficha de
   tienda publicada dice, en los dos idiomas: "**No es control parental. No vigila a
   otras personas ni reporta a nadie**" (`docs/STORE_LISTING.md:53`).
8. **El círculo no puede representar lo que se pidió.** Unirse es una solicitud que la
   otra persona acepta, nunca una llave (adenda del ADR-0021); la membresía es simétrica
   —si el padre ve al hijo, el hijo ve al padre—; el consentimiento es por métrica y lo
   fija el dueño del dato; y la unidad que viaja es una fila por persona **por semana**,
   nunca una sesión. No existe tutor, ni menor, ni dispositivo supervisado, ni una
   cuenta que actúe por otra: el servidor fuerza cada escritura al que llama y "no
   confía en ningún id del cuerpo" (`server/src/app.ts:250`).

El punto 7 es el que decide la forma de este ADR. La función que se pidió —un panel
donde un padre ve los intentos de su hijo— no es difícil: es la que la app dijo
públicamente que no hace. Este ADR no repite la objeción, la convierte en diseño: se
queda con el valor del caso de uso y cambia el sitio donde ocurre.

## Decisión

### 1. La llave es una salida más de una sesión profunda

No hay profundidad nueva ni estado nuevo. Una sesión con llave corre como `deep` —sin
pie, sin ritual, sin botón de salir— y suma una única forma de terminar: volver a
escanear la llave que la abrió. El `CloseOutcome` gana un nombre, porque hoy toda salida
a mano es `'cancelled'` y esta no lo es: la sesión que cierra su llave termina como
`'completed'` si llegó a su tiempo y `'cancelled'` si no, con `exitReason` marcado con
un centinela nuevo al lado de `EMERGENCY_EXIT_REASON`.

**La emergencia sigue intacta.** Cinco al mes, ruta propia, diez segundos de espera. Es
la condición para que esto sea aceptable: un teléfono cuya llave está sin batería, o en
otra ciudad, no puede quedar cerrado. Esto no se negocia en una revisión posterior.

### 2. La llave es un secreto compartido y el código rota

Emparejar ocurre una vez: el dispositivo llave muestra un código de emparejamiento, el
teléfono lo escanea, y ambos guardan un secreto de 32 bytes. A partir de ahí el código
que se muestra es una derivación de ese secreto y de la ventana de tiempo actual, como
un TOTP: cambia cada treinta segundos, y el teléfono lo verifica **sin red**, contra su
propia copia del secreto y su propio reloj.

Esto conserva la regla 7 entera. Abrir y cerrar una sesión nunca depende de que haya
señal, y la cercanía física la impone la cámara: hay que estar frente al otro
dispositivo. Una foto del código sirve treinta segundos.

### 3. El código parece un campo de puntos y por dentro es un QR

El usuario pidió que no fuera un QR cuadrado. La forma de darle eso sin escribir un
decodificador a mano es separar lo que el código *es* de cómo se *dibuja*: el contenido
es un QR estándar —que ya sabemos codificar— y el dibujo usa puntos redondos en la
paleta de la app en vez de módulos cuadrados negros, que es lo que ya hace `QrCode.tsx`
con una geometría distinta. Los decodificadores estándar lo leen igual mientras se
respeten los patrones de localización y el contraste; eso hay que verificarlo con la
cámara real antes de dar la forma por buena.

La opacidad puede animarse —el campo puede encenderse al aparecer, como `HeatGrid`—
pero la animación es decorativa: el código es válido en cualquier fotograma, incluido el
único que se ve con "Reducir movimiento".

### 4. La cámara entra como capacidad, y este ADR revierte la decisión del ADR-0021

Un módulo nuevo en `src/platform/` con su `status()` y su `reason`, un miembro nuevo en
`CapabilityName`, el permiso pedido en su flujo y no antes, y la pantalla diciendo por
qué no cuando no lo hay (regla 8). La dependencia nativa se justifica así: la cámara no
se puede dibujar con `View` y SVG, y el decodificador nativo que trae evita escribir a
mano la mitad difícil de un QR. La prohibición de la regla "no agregues librerías" es de
UI, gráficos y QR; esto es ninguna de las tres, pero el ADR-0021 sí dijo que no habría
escáner y **este ADR lo reemplaza en ese punto**, sin tocar su cuerpo.

### 5. El recibo, no el panel

Esta es la decisión central. Quien tiene la llave **no recibe datos**: los lee en
persona, en el momento de desbloquear, en la pantalla del teléfono que estuvo bloqueado.

Al escanear para salir, esa pantalla muestra el resumen de la sesión que acaba de
terminar: cuánto duró y si llegó a su tiempo o se cortó. Las dos personas están una al
lado de la otra, porque escanear exige estar ahí. Lo leen juntas y se va.

Qué se gana: no viaja nada, no se guarda nada en el servidor, no entra al círculo, no
hay una métrica nueva que alguien comparta sin querer, y la frase de la ficha de tienda
sigue siendo verdad. El dueño del dato ve exactamente lo mismo que ve el otro, al mismo
tiempo. Es un recibo, no un expediente.

Qué se pierde, y hay que decirlo: el padre que no está en la casa no ve nada. Eso es
deliberado.

**El conteo de intentos queda fuera de la primera versión.** Contar cuántas veces subió
el escudo es posible en Android, donde `ForegroundWatcher` ya sabe qué paquete está al
frente, y es imposible en iOS. El recibo de la v1 dice lo mismo en los dos sistemas:
duración y cómo terminó. Si el conteo entra después, entra con su asimetría explicada en
pantalla por `status().reason`, y nunca con nombres de apps en ninguna de las dos.

### 6. El círculo no cambia

Emparejar una llave no mete a nadie en ningún círculo. Si las dos personas quieren
además estar en el mismo círculo, la pantalla de emparejamiento puede ofrecer mandar la
invitación, que sigue siendo una solicitud que la otra persona acepta, con sus topes de
12 y sus tres interruptores. Un código que también fuera llave del círculo es
exactamente lo que la adenda del ADR-0021 se escribió para impedir.

### 7. Fuera de este ADR, a propósito

La página web que muestra la llave se diseña aparte, en el ADR-0035, y no se implementa
hasta que la llave entre dos teléfonos exista y se use. Hoy no hay web en el repo —ni
`react-dom`, ni `react-native-web`, y el servidor es solo API— y, sobre todo, una llave
remota haría que terminar una sesión dependiera de la red, que es justo lo que el
ADR-0033 se cuidó de no romper: "nada de la app depende de que responda". Ese es el
problema central que el 0035 tiene que resolver antes de que valga la pena escribirla.

## Consecuencias

- La app gana su primera capacidad de entrada: hasta hoy solo escribía en el sistema
  (notificaciones, escudo, Live Activity) y leía de Salud. La cámara es la primera vez
  que el mundo exterior puede cambiar el estado de una sesión.
- `src/design/components/index.ts` crece con el campo de puntos; el visor de cámara vive
  en `src/platform/`, como `BlockingSelectionView`, porque es una vista nativa.
- Una ruta nueva bajo `session/` para escanear, que hereda la regla 1: pantalla completa,
  sin gesto de volver.
- Dos capacidades nuevas que declarar en la ficha de Play y en `app.json`: el permiso de
  cámara con su cadena de uso. La declaración de Play hay que actualizarla.
- El emparejamiento guarda un secreto por llave. Va en el llavero, no en SQLite, como el
  secreto de cuenta del ADR-0033.
- Un reloj desincronizado entre los dos dispositivos rompe el TOTP. Hay que tolerar una
  ventana de más y una de menos, y decirlo en pantalla cuando falle por eso.
- Copy nueva en `src/i18n/es/` y `src/i18n/en/`, en las dos, o `tsc` falla.

## Alternativas descartadas

- **El panel remoto de vigilancia** (el padre ve desde su teléfono, en vivo, los intentos
  del hijo). Descartada: contradice la ficha publicada, exige enmendar la lista de lo que
  nunca sale del ADR-0033, necesita una relación asimétrica que el servidor no puede
  representar, es imposible en iOS al nivel de app, y un aviso en vivo durante la sesión
  del hijo es el único caso que la regla 11 prohíbe de forma absoluta.
- **El código animado que lleva información en el movimiento.** Imposible: con "Reducir
  movimiento" el componente salta a su estado final y el código tiene que seguir siendo
  válido.
- **Que escanear la llave meta al hijo en el círculo.** Contra la adenda del ADR-0021.
- **Una profundidad nueva `locked`.** Innecesaria: `deep` ya significa lo que hace falta;
  agregar una cuarta obligaría a tocar `effectiveDepth`, `allowsBreaks`, `interrupt` y el
  selector de modos, para el mismo comportamiento.
- **NFC en vez de cámara.** Más cerca del Brick real, pero exige un tag físico, que es
  justo lo que el pedido quería evitar, y en iOS el lector de NFC en segundo plano tiene
  sus propias restricciones.

## Decidido por el dueño

Las tres preguntas que este ADR abrió, respondidas el 2026-09-22:

1. **El recibo se lee en persona.** No hay panel remoto. Quien tiene la llave ve el
   resumen en el teléfono que estuvo bloqueado, en el momento de desbloquear. Nada viaja
   y no hay que enmendar el ADR-0033 ni reescribir la ficha de tienda.
2. **El conteo de intentos no entra en la v1.** El recibo dice lo mismo en iOS y en
   Android.
3. **La llave web se diseña ya, como fase 2, sin implementarla**: ADR-0035.
