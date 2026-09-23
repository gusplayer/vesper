# ADR-0039 — La gracia sostiene la cadena, no suma un día

**Estado:** aceptada · 2026-09-23 · enmienda a ADR-0027

## Contexto

ADR-0027 creó la racha diaria: diez minutos de foco hacen que un día cuente, y hay tres
días de gracia al mes para que una vida normal no rompa la cadena. Lo que el ADR **no**
dice es qué hace la gracia con el número.

La implementación decidió por su cuenta, y un test lo fijó: dos días con foco, uno
puenteado por gracia y tres días con foco dan **6** (`streak.test.ts`). Es decir, un día
en el que el usuario no enfocó ni un minuto **incrementa** el contador de días enfocados.

Eso choca con la postura de toda la app. La regla del proyecto es no presentar como
verificado lo que no lo está: el uso por app es siempre un piso, el tiempo declarado
nunca se suma al verificado, y donde una capacidad no existe la pantalla lo dice. Un
número llamado "días seguidos" que incluye días sin foco es la misma clase de mentira
pequeña, en el número que el usuario mira todos los días.

## Decisión

**La gracia impide que la cadena se rompa; no aporta un día al conteo.** Dos días con
foco, uno de gracia y tres con foco son **5**, no 6.

La cadena sigue viva: el día siguiente al puenteado continúa la racha en vez de empezar
de cero. Lo único que cambia es que el día sin foco no se cuenta a sí mismo.

## Consecuencias

- El número dice lo que su nombre promete: días en los que el usuario enfocó al menos
  diez minutos, seguidos, con los huecos perdonados sin ser contados.
- A quien tenga una racha viva con gracia gastada el número le baja —hasta tres— la
  primera vez que abra la app con esta versión. Es la corrección de un número que estaba
  inflado, y no hay forma de hacerla invisible.
- Los tres días de gracia al mes, su reinicio mensual y el cobro de cada día a su propio
  mes no cambian.
- Alternativa descartada: dejarlo como estaba y escribirlo en ADR-0027 como intencional.
  Se descarta porque el argumento que lo sostendría —"premiar la constancia"— es el
  argumento de las medallas y los puntos, que este proyecto rechaza por regla.
