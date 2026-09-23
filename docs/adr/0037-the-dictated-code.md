# ADR-0037 — El código dictado: la llave a distancia, sin que la salida dependa de la red

**Estado:** aceptada · 2026-09-23 · segundo transporte de la llave del ADR-0035

## Contexto

El dueño preguntó si la llave puede funcionar con las dos personas en ciudades distintas,
y si él mismo podría bloquearse desde el computador. El ADR-0036 ya había mirado eso y lo
había dejado en pausa por una razón concreta: si terminar una sesión necesita una página
web, necesita red, y un teléfono sin señal queda encerrado.

Pero escanear es **un transporte, no la llave**. El código es una cadena corta derivada de
un secreto compartido; la cámara solo es una forma de moverla de una pantalla a otra. Si
esa cadena se puede leer en voz alta, viaja por una llamada, un mensaje o un grito desde
la cocina, y **la verificación sigue siendo local**: el teléfono bloqueado la compara
contra su propia copia del secreto, sin red, igual que hoy. La regla 7 no se toca.

Lo que ya existe y hace esto barato:

- **El alfabeto para dictar ya está escrito.** `src/domain/circle.ts:403`:
  `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 32 símbolos sin 0, O, 1 ni I, con el comentario
  "un código se lee en voz alta o se teclea desde una captura". Se escribió para el código
  de invitación del círculo y sirve igual aquí.
- **La marca de agua por llave** (`paired_keys.last_step`, ADR-0035) ya hace que un código
  valga una sola vez, diga lo que diga el reloj.
- **`FieldRow`** ya sabe recibir un código corto, con `maxLength` y el error como una línea
  en rojo debajo, como hace `circle/invite`.

Y lo que no existe, y este ADR tiene que inventar: **no hay ningún freno de intentos en
todo el proyecto**. Nunca hizo falta, y la razón es exacta: **una cámara no puede
enumerar; un teclado sí.** Hoy un código equivocado no cuesta absolutamente nada.

## La aritmética, porque decide el diseño

El espacio de un código dictado y lo que tarda en romperse. Tres códigos están vivos a la
vez (la ventana actual y una a cada lado), así que cada intento a ciegas acierta con
probabilidad 3/N, no 1/N:

| Opción | Espacio | Bits | Intentos esperados | Guionado con un script a 10/s |
|---|---|---|---|---|
| 6 dígitos | 10⁶ | 19,9 | 333 333 | **9 horas** |
| 6 símbolos base-32 | 1,07 × 10⁹ | 30 | 3,6 × 10⁸ | 414 días |
| 8 símbolos base-32 | 1,10 × 10¹² | 40 | 3,7 × 10¹¹ | 1 161 años |
| escaneado (hoy) | 2,8 × 10¹⁴ | 48 | — | — |

Seis dígitos se rompen en una noche con un teclado bluetooth y una macro, sin jailbreak y
sin computador. Están descartados. Seis símbolos aguantan, pero solo con freno. **Ocho
aguantan aunque todo lo demás falle**, y eso importa porque todos los otros frenos viven
en estado que el dueño del teléfono puede tocar: un contador en SQLite, un bloqueo atado a
un reloj que él controla, una app que puede relanzar. Cuarenta bits siguen siendo verdad
cuando nada de eso queda en pie. El costo son tres segundos en una llamada que ya dura
minutos.

## Decisión

### 1. Ocho símbolos del alfabeto que ya existe, en dos grupos de cuatro

`K7QM-3PFX`. El alfabeto sale a `src/domain/dictation.ts` y `circle.ts` pasa a importarlo:
una sola definición para las dos cosas que se dictan en esta app. El guion es solo para
leer; al teclear se aceptan espacios, guiones y minúsculas, y se normaliza.

Un código mal tecleado dice qué forma tiene un código, nunca "no existe", como ya hace el
círculo: "Un código son ocho letras o números, sin ceros ni oes."

### 2. Derivación aparte, con su propia granularidad

`HMAC(secreto, "VKT1:" + idDeLlave + ":" + ventana)`, cuarenta bits en base-32. **No es un
recorte del código escaneado**: son dos transportes con dos derivaciones, así que ver uno
no adelanta nada sobre el otro.

**La ventana es de cinco minutos, con una a cada lado: el código vive entre diez y quince
minutos.** Una llamada telefónica no cabe en noventa segundos. Y esto se hace con un
**paso más largo, jamás con una tolerancia más ancha**: mantener pasos de 30 s y aceptar
±20 dejaría 41 códigos vivos y regalaría 5,4 bits. Con paso largo son tres, como hoy.

La llave gana una segunda marca de agua, `last_typed_step`, porque las dos unidades no son
la misma. Las dos solo suben.

### 3. Un freno contado por sesión, no por reloj

Diez intentos fallidos en una sesión y el código dictado se apaga **para esa sesión**;
escanear y la emergencia siguen intactos. Se cuenta en la fila de la sesión, no en el
reloj, por una razón concreta: **el atacante es dueño del reloj**, así que cualquier
bloqueo de "espera diez minutos" se salta moviendo la hora, y un contador en memoria se
reinicia relanzando la app.

Con diez intentos por sesión, la probabilidad de acertar a ciegas es 2,7 × 10⁻¹¹.

### 4. La sesión con código dictado no se cierra en sus primeros quince minutos

El ADR-0035 puso dos minutos con una justificación aritmética: "dos minutos sobreviven a
cualquier código que ya pudiera estar capturado cuando la sesión empezó". Eso era cierto
contra noventa segundos. **No es cierto contra quince minutos**, así que la invariante —
que la edad mínima supere la vida máxima del código— obliga a subir el mínimo a quince
minutos **solo para cerrar por código dictado**. Escanear sigue en dos.

La emergencia sigue siendo la salida de quien de verdad tiene que irse antes.

### 5. Dictar se enciende por llave, y viene apagado

`paired_keys.typed_enabled`. Una llave nueva solo funciona escaneando; quien la tiene
decide si además se puede dictar. No es paranoia: **la fricción es el producto.** Escanear
cuesta caminar hasta la cocina, y ese costo es lo que hace que la llave signifique algo.
Dictar convierte "ven acá" en "pregúntame", y una casa debería poder elegir si quiere eso.

En el dispositivo llave el código dictado está escondido tras un toque deliberado, y se
vuelve a esconder. Ocho caracteres se leen desde el otro lado de una sala; un campo de
puntos no.

### 6. Sirve para abrir y para cerrar, y aquí me aparto de la recomendación

El equipo recomendó **solo cerrar**, con un argumento bueno: una capacidad que solo agrega
salidas nunca puede dejar a nadie más encerrado, y un bloqueo que se puede activar a
distancia se parece al control parental que la ficha de tienda niega.

Lo tomo en parte y lo rechazo en lo demás, por dos razones:

- **Solo cerrar borra el caso de uso que se pidió.** Con el padre de viaje y la llave con
  él, el hijo no podría ni empezar una sesión con llave. La función quedaría existiendo
  solo para los días en que están en la misma casa, que son justo los días en que escanear
  ya funciona.
- **Nadie bloquea a nadie: el teléfono bloqueado siempre teclea.** Un código dictado no
  hace nada por sí solo. La persona que se va a bloquear escribe ocho caracteres en su
  propio teléfono. Eso no es control remoto, es alguien pidiendo el candado y otro
  concediéndolo desde lejos. La diferencia es exactamente la que separa este producto del
  que la ficha niega.

Lo que sí conservo de la recomendación es el mínimo de quince minutos, que es lo que
impide la sesión de mentira: abrir con un código y cerrar con el siguiente en la misma
llamada para aparentar que se cumplió.

### 7. Un desbloqueo dictado no tiene recibo, y hay que decirlo

El ADR-0035 decidió "el recibo, no el panel": quien tiene la llave lee el resumen en el
teléfono del otro, en persona, porque escanear exige estar ahí. **Por teléfono eso no pasa
y no puede pasar**: el recibo vive en el teléfono bloqueado y nada viaja (regla 7,
ADR-0033). Un desbloqueo dictado se autoriza a ciegas. Es el precio del transporte y queda
escrito, no se deja caducar en silencio.

Tampoco hay botón de "pedir el código". Vesper no lleva la petición: durante una sesión no
notifica nada (regla 11, ADR-0027) y los datos no salen (ADR-0033). La persona levanta el
teléfono y llama.

### 8. Un transporte, nunca una llave

Quitar la llave quita los dos transportes. No existe una llave que solo funcione dictada,
igual que el ADR-0036 escribió que una llave web nunca puede ser la única. Y la emergencia
no se toca: cinco al mes, ruta propia, diez segundos, y un código mal tecleado no gasta
ninguna.

## Consecuencias

- Migración 010: `paired_keys.typed_enabled` y `last_typed_step`, más `sessions.key_tries`.
- `src/domain/dictation.ts` nuevo, y `circle.ts` deja de tener el alfabeto propio.
- Dos pantallas ganan una entrada de texto: `session/unlock` y `keys/scan`.
- La llave dictada **no** llega a Android antes que a iOS ni al revés: es puro dominio.
- Lo que este ADR **no** resuelve: el caso del computador propio sigue necesitando que algo
  muestre el código, y hoy eso es otro teléfono. La página web sigue siendo el ADR-0036.

## Límites aceptados

- **Una foto o un mensaje con el código sirve hasta quince minutos**, diez veces más que
  antes. La ventana es literalmente el tamaño de la llave de repuesto que alguien puede
  guardarse. Quince minutos es el máximo que acepto; una hora ya sería una llave de
  repuesto y un día sería no tener candado.
- **Un código abre todos los teléfonos emparejados a esa llave** dentro de su ventana,
  porque la marca de agua es por dispositivo. Con la cámara había que llevar los dos
  teléfonos hasta la llave; dictando, uno sirve para la casa entera.
- **La ingeniería social es el ataque**, y no tiene defensa técnica: quien tiene la llave
  no ve quién pregunta.
- **La dependencia se mueve al lado del padre.** Dormido a las dos de la mañana, sin
  señal, sin batería. La verificación sigue sin red, pero **producir** el código depende de
  que una persona conteste. Por eso la emergencia sigue siendo la única salida que no
  depende de nadie, y por eso la pantalla dice cuántas quedan **antes** de cerrar el
  candado, no después.

## Alternativas descartadas

- **Seis dígitos.** Nueve horas con un teclado y una macro.
- **Ampliar la tolerancia en vez del paso.** Cuarenta y un códigos vivos y 5,4 bits
  regalados, para el mismo resultado.
- **Reusar el código escaneado como texto.** Doce hex se dictan peor que ocho base-32 y
  atarían las dos ventanas.
- **Un botón de "pedir desbloqueo"** que avise al otro teléfono. Contra la regla 11 y
  contra el ADR-0033.
- **Que dictar venga encendido.** Sería agregarle una puerta de atrás a toda llave que ya
  existe, sin que su dueño lo pida.
