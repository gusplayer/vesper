# ADR-0049 — Terminar un vínculo del círculo en el servidor

**Estado:** aceptada · 2026-09-25. Enmienda ADR-0033 y ADR-0044. Decidido en ADR-0047 §5.
Sin desplegar: desplegarlo sigue siendo decisión del dueño.

## Contexto

Rechazar, Quitar, Salir del círculo y Salir del reto (de uno ajeno) solo cambiaban este
teléfono. El servidor no tenía cómo cortar un vínculo, y la sincronía no podía decirlo:
es un cursor sobre `updated_at`, y una fila borrada nunca vuelve por el cursor. La otra
persona seguía viendo tu semana, podía darte ánimo y empujarte, y quien pidió entrar
esperaba para siempre. La pasada de UI hizo que las confirmaciones lo dijeran; esto lo
arregla.

## Decisión

1. **`POST /link/end`** con `{ memberId }` (Rechazar, Quitar) o `{ everyone: true }`
   (Salir del círculo). Borra las dos direcciones del vínculo, sea cual sea su estado, y
   cada uno sale de los retos que hizo el otro: una marca que siguiera llegando a quien
   quitaste es justo el "te sigue viendo" que esto termina. Los retos de un tercero
   conservan a los dos, porque los dos siguen en su círculo.
2. **El fin se guarda por par** en `ended_links (a_id, b_id, ended_at)`, con `a_id < b_id`,
   y `/sync` devuelve `ended`: los ids cuyo vínculo con el llamante terminó después del
   cursor. Así se entera el otro teléfono, que borra a esa persona con todo lo suyo y
   archiva los retos que hizo. Un vínculo nuevo entre los dos (otra solicitud) borra el
   fin: lo reemplaza.
3. **`POST /challenge/leave`** con `{ challengeId }`: el llamante deja de ser participante,
   nadie lo ve en el reto ni puede empujarlo en él. Sus marcas quedan como filas y dejan
   de mostrarse, porque una fila de avance solo se dibuja para participantes. Salir de un
   reto no termina ningún vínculo.
4. **Las dos llamadas responden 200 a todo cuerpo bien formado**, aunque no quedara nada
   que terminar: el teléfono reintenta tras una respuesta perdida, y así un **404** solo
   puede significar una cosa, que el servidor desplegado es anterior a este ADR. Un fin
   pedido para alguien sin vínculo no escribe nada: registrarlo le entregaría al extraño
   el id de quien lo pidió.
5. **En el teléfono, primero lo local y después la red** (ADR-0044 §5). Cada acción se
   escribe en SQLite y deja el fin en una cola guardada (`circle_pending_ends`,
   `circle_pending_leaves`), que la sincronía manda **antes** de subir lo suyo, para que
   la misma respuesta ya deje fuera a esa persona. Mientras la cola no se vacía, lo que
   el servidor todavía mande de esa persona no vuelve a entrar.
6. **Mientras el servidor no tenga la llamada, la app dice lo que pasa de verdad.** El
   primer 404 se recuerda (`circle_link_end_support = 'no'`), y desde ahí las
   confirmaciones dicen que la otra persona sigue viendo tu semana. Después de actuar,
   una línea lo repite. El fin queda en la cola: el día que el servidor tenga la llamada,
   sale solo, y el recuerdo pasa a `'yes'`.

## Consecuencias

- Una tabla nueva, `ended_links`, creada al arrancar como el resto del esquema, con
  borrado en cascada desde `accounts`. Tres métodos en el contrato del almacén
  (`endLink`, `endedLinksOf`, y `putLink` que olvida un fin), en memoria y en Postgres.
- `/sync` gana `ended`. Un teléfono con una versión anterior lo ignora.
- Borrar la cuenta sigue sin avisar a los demás, como hasta ahora: sus filas se van en
  cascada y el otro teléfono deja de recibir su semana, pero no sabe que se fue. Queda
  fuera de este ADR.
- Alternativa descartada: un estado `ended` dentro de `links`. Un teléfono viejo lee
  cualquier estado desconocido como `pending`, y alguien quitado reaparecería pidiendo
  entrar.
