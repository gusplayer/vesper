# ADR-0050 — Correo de recuperación con Resend, y un segundo dispositivo en la misma cuenta de Apple

**Estado:** aceptada · 2026-09-25. Acepta el punto 8 del ADR-0048, que quedó propuesto, con
Resend como proveedor (lo eligió el dueño del producto). Corrige la bienvenida del
ADR-0048 para el caso de un iPhone y un iPad con la misma cuenta de Apple.

## Contexto

**El correo.** El ADR-0048 dejó un hueco: teléfono perdido, cambio de sistema y ninguna
clave guardada. El punto 8 lo cierra con un correo opcional y un código, a un precio: para
que un correo solo baste, el servidor tiene que poder devolver el secreto. El dueño del
producto aceptó ese precio y eligió Resend.

**El segundo dispositivo.** Vesper corre en iPad en modo iPhone (`supportsTablet: false`).
El llavero de iCloud sincroniza a todos los aparatos de la cuenta de Apple, así que un
iPad con la misma cuenta **encuentra la identidad del iPhone** y la bienvenida ofrece:

- "Restaurar": rota el secreto, y el iPhone, que sigue en uso, deja de respaldar y de
  ver su círculo sin saber por qué.
- "Empezar de cero": **borra la cuenta del iPhone**, con su respaldo y su círculo.

Las dos cosas estaban pensadas para un teléfono nuevo que reemplaza al perdido, no para un
aparato que convive con otro.

## Decisión

### El correo de recuperación

1. **Opcional, en Ajustes › Respaldo › Correo de recuperación.** Se escribe el correo, llega
   un código de seis dígitos y se confirma. La pantalla dice el precio en una línea: con un
   correo, Vesper puede devolverte tu clave, así que el respaldo deja de estar cerrado solo
   para ti. Se puede quitar cuando se quiera, y quitarlo borra la copia de la clave.
2. **El servidor guarda la clave cifrada con una llave que no vive en la base**
   (`RECOVERY_KEY`, variable de Railway), con AES-256-GCM y el id de la cuenta como dato
   autenticado. Una filtración de la base sola no la abre. Al confirmar el correo, el
   servidor toma el secreto del propio `Authorization` de esa petición; al rotarlo (ADR-0048
   §5), vuelve a guardar el nuevo.
3. **Recuperar**, en "Tengo una clave" › "Recuperar con mi correo": correo, código, y el
   servidor devuelve `{ id, secret }`. De ahí sigue la restauración de siempre (probar,
   abrir el respaldo, rotar, rehacer el círculo, resubir).
4. **Nada revela si un correo existe.** Pedir un código responde igual haya o no una cuenta
   con ese correo; un código equivocado y un correo desconocido responden lo mismo.
5. **Códigos:** seis dígitos, se guardan con hash, duran diez minutos, cinco intentos. Topes
   por dirección y por correo.
6. **Un correo, una cuenta.** Confirmar un correo que ya usa otra cuenta se lo quita a esa:
   quien lo confirma demuestra que controla ese buzón.
7. **Resend** envía desde `RECOVERY_FROM`, un remitente de un dominio verificado en Resend,
   en el idioma que pide el teléfono. Sin `RESEND_API_KEY`, `RECOVERY_FROM` o `RECOVERY_KEY`,
   las rutas responden `503 email not configured` y la app dice que todavía no está
   disponible (regla 8). En local, sin base de datos, el código se escribe en la consola.

### Un segundo dispositivo

8. **Una identidad es un dispositivo activo a la vez.** Usar el iPhone y el iPad con los
   mismos datos a la vez sería sincronía entre dispositivos, que el ADR-0048 descartó.
9. **La bienvenida sabe si el Vesper encontrado sigue en uso.** `GET /account` devuelve
   `lastSeenAt`, la última vez que se vio **antes** de esta petición, y la plataforma.
   - **Usado en los últimos 30 días:** "Este Vesper se usó hace 2 horas en otro dispositivo".
     Las opciones son **"Traerlo aquí"** (restaurar, confirmando que el otro dispositivo deja
     de respaldar y de ver el círculo) y **"Empezar aparte"**, una identidad propia para este
     dispositivo que **no borra nada** y cuyo secreto **no entra en el llavero que viaja**:
     la identidad que viaja sigue siendo la del otro.
   - **Sin uso en 30 días:** lo de antes, "Restaurar" y "Empezar de cero" (que borra, con
     confirmación).
10. **El dispositivo que se quedó atrás lo dice.** Si su clave deja de servir (401), Ajustes ›
    Respaldo explica que el Vesper se trasladó a otro dispositivo o que la clave cambió, y
    ofrece "Tengo una clave" o "Empezar una identidad nueva".

## Consecuencias

- El servidor guarda, solo de quien lo activa, un correo verificado y una copia cifrada de
  su clave. Hay que declararlo en la privacidad (ADR-0046) y en las fichas de Apple y
  Google: correo, vinculado a la persona, para gestionar la cuenta, opcional.
- `RECOVERY_KEY` no se puede perder: sin ella, las copias de la clave no se abren y quien
  tenía correo tiene que confirmarlo de nuevo. Vive en las variables de Railway.
- Resend exige un dominio propio verificado; el sitio en `*.vercel.app` no sirve.
- Un iPad con "Empezar aparte" tiene sus propios datos. Si pierde el iPad, su identidad
  vuelve con su clave o su correo, no sola por iCloud.

## Alternativas descartadas

- **Sign in with Apple o Google como recuperación:** dos SDK y el par obligado de la guía 4.8,
  para lo mismo que cubre un correo (ADR-0048).
- **Correo sin copia de la clave (el usuario conserva una frase):** vuelve a exigir la clave,
  que es justo lo que el correo viene a reemplazar.
- **Sincronizar el iPhone y el iPad:** conflictos entre dispositivos y una base legible en el
  servidor, las razones por las que el ADR-0048 descartó la sincronía en claro.
- **Llavero que guarde varias identidades:** resuelve elegir entre varias, pero no evita que
  dos aparatos compitan por la misma; la fecha de uso sí.
