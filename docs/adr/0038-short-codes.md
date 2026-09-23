# ADR-0038 — Los códigos se dictan en una respiración: seis dígitos, no ocho caracteres

**Estado:** aceptada · 2026-09-23 · enmienda el ADR-0037

## Contexto

El ADR-0037 eligió ocho símbolos de un alfabeto de 32 —`K7QM-3PFX`— porque cuarenta bits
aguantan aunque se caigan todas las demás defensas. Es un buen instinto de ingeniería y
le puso precio cero a la fricción, que es lo que el producto vende.

El dueño lo corrigió: **los códigos tienen que ser fáciles, cortos y rápidos.** Tiene
razón, y por dos motivos que el análisis de seguridad no pesó:

1. **Dictar letras por teléfono es un trabalenguas.** El alfabeto quita 0, O, 1 e I, pero
   deja B y V, M y N, que en español se confunden por teléfono exactamente igual. Ocho
   caracteres alfanuméricos obligan a deletrear: "eme de México". Seis dígitos no:
   "tres, cuatro, ocho, dos, nueve, uno" no tiene ambigüedad en ningún acento del idioma.
2. **Los dígitos abren el teclado numérico.** `FieldRow` ya acepta `keyboardType`, así que
   teclear pasa de buscar letras en un teclado completo a seis toques grandes.

Y al rehacer la aritmética con la defensa correcta en el centro, el largo importa mucho
menos de lo que el ADR-0037 supuso.

## La aritmética, otra vez

Lo que defiende un código corto no es su entropía: es **el tope de intentos por sesión**.
Y ese tope es duro por una razón estructural que conviene decir en voz alta: el contador
vive en la fila de la sesión, así que relanzar la app, matarla o mover el reloj no lo
reinician, y **conseguir una sesión nueva exige la llave que se está atacando**. No hay
forma de cosechar intentos.

Con tres ventanas vivas y sesenta sesiones al mes:

| | 3 intentos | 5 intentos | 10 intentos |
|---|---|---|---|
| 4 dígitos | 1 vez cada 2 años | 1 vez al año | varias al año |
| **6 dígitos** | 1 cada 154 años | **1 cada 93 años** | 1 cada 46 años |
| 8 base-32 | 1 cada 170 millones de años | — | — |

Ocho caracteres compran ciento setenta millones de años en vez de noventa y tres. Nadie
necesita esa diferencia para un candado doméstico que además tiene salida de emergencia,
y se paga en cada llamada.

Cuatro dígitos sí se quedan cortos: una vez al año por teléfono es demasiado cuando el
hijo lo intenta cada sesión. **Seis es el piso.**

## Decisión

1. **Seis dígitos.** `348-291`, en dos grupos de tres para leerlos. El alfabeto de
   dictado del ADR-0037 se queda para el código de invitación del círculo, que se teclea
   una vez y se comparte por link.
2. **Cinco intentos por sesión**, no diez. Deja margen para dos dedos gordos y sigue en
   una vez cada noventa y tres años.
3. **Teclado numérico** en las dos pantallas que lo reciben.
4. Todo lo demás del ADR-0037 se queda igual: ventana de cinco minutos con una a cada
   lado, marca de agua propia, quince minutos de sesión antes de poder cerrar dictando,
   apagado por llave, y sin recibo en un desbloqueo dictado.

## Consecuencias

- El código dictado baja de 40 bits a 20. Queda escrito arriba lo que eso cuesta y por
  qué es aceptable: el tope de intentos, no la longitud, es lo que sostiene el candado.
- Si algún día el tope de intentos deja de ser confiable —por ejemplo si el contador se
  mueve fuera de la sesión— este número hay que volver a subirlo. La dependencia queda
  anotada aquí para que nadie la rompa sin verla.
- `domain/dictation.ts` gana la versión en dígitos y conserva la de símbolos para el
  círculo.

## Alternativas descartadas

- **Cuatro dígitos.** Una vez al año por teléfono.
- **Seis símbolos base-32.** Más seguro que suficiente y sigue obligando a deletrear.
- **Subir el tope a diez intentos para compensar.** Va en la dirección contraria: el tope
  es la defensa, no el sitio donde ahorrar.
