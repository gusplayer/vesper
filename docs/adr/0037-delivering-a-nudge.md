# ADR-0037 — Cómo llega un empujón del círculo al teléfono

**Estado:** propuesta · 2026-09-23

## Contexto

La regla 11 y el ADR-0027 son tajantes: el círculo notifica solo lo que otra persona
hizo, con interruptor, y **nunca durante una sesión**. ADR-0033 afirmó que eso ya estaba
resuelto: *"un push que llega en sesión se retiene y se muestra al cerrar (ADR-0027 §1),
y eso ya está escrito del lado del cliente"*.

Las dos mitades de esa frase son falsas, y conviene decirlo antes de que alguien
construya encima:

- `server/src/push.ts` manda a Expo un mensaje con `title` y `body`, es decir una
  **alerta visible**. El sistema operativo la muestra antes de que la app la vea; no hay
  nada que el cliente pueda "retener".
- No existe cliente de push: no hay `getExpoPushToken` ni
  `addNotificationReceivedListener` en `src/`, y `platform/notifications.ts` muestra
  banner para toda notificación en primer plano.

Hoy no rompe nada porque la app todavía no habla con el servidor. El día que se conecte,
un empujón enviado a las 10:40 suena a mitad de una sesión de foco profundo, que es
exactamente lo que la regla 11 prohíbe.

## Decisión propuesta

1. **El servidor manda un push silencioso**, sin `title` ni `body`: solo datos, con
   `_contentAvailable: true` (iOS) y prioridad normal. El servidor no sabe si quien
   recibe está en sesión, y no debería: esa es información del teléfono.
2. **La notificación la compone el teléfono**, con el diccionario del idioma del
   aparato, y pasa por el mismo presupuesto de ADR-0027 que todo lo demás: máximo dos
   avisos al día fuera de sesión, nada entre 22:00 y 8:00, y **silencio absoluto durante
   una sesión o una pausa**. Un empujón que llega en sesión espera a que la sesión
   cierre; si para entonces cayó en horas de silencio, espera a la mañana.
3. **Un empujón caducado no suena.** Un empujón es de un día (ADR-0021): si la sesión
   termina al día siguiente, el empujón ya no se muestra, se queda en la pantalla del
   círculo.
4. Si el push silencioso no despierta la app (Android con la batería restringida, iOS
   con presupuesto agotado), el empujón aparece igual la próxima vez que la app abra y
   sincronice. No se compensa con una alerta.

## Consecuencias

- El servidor deja de decidir qué texto ve alguien: manda un hecho, no una frase. De
  paso desaparece el vector de que un desconocido que acierte un código de invitación
  entregue un push con texto elegido por él.
- ADR-0033 necesita una nota al pie: su párrafo sobre la retención en sesión describe
  algo que no existe. No se edita su cuerpo (regla del proyecto); la nota remite aquí.
- Cuesta una tanda de trabajo del lado del cliente que todavía no empieza: registro del
  token, recepción en segundo plano y composición local. Este ADR existe para que esa
  tanda no la improvise quien la haga.
- Alternativa descartada: mandar la alerta visible y confiar en que el usuario apague el
  interruptor si le molesta. Convierte una regla dura del producto en una preferencia.
