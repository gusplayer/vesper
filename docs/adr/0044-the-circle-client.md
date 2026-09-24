# ADR-0044 — El cliente del círculo: cuenta, clave de respaldo y sincronía

**Estado:** aceptada · 2026-09-24

## Contexto

ADR-0033 dejó el servidor desplegado y ADR-0034 la página que recibe una invitación.
La app no le habla a ninguno de los dos: `platform/circle.status()` sigue devolviendo
`available: false`, y el círculo entero —personas, semanas, ánimos, retos— es la semilla
de demostración. ADR-0037 decidió cómo viaja un empujón, y su mitad del teléfono también
espera aquí.

El servidor ya fijó el contrato (`server/README.md`): el id de la cuenta **es**
`profile.id`, un `409 invite code taken` significa subir `codeGeneration` y reintentar,
todo id es UUID v7, y el secreto se entrega **una sola vez** al crear la cuenta.

Queda por decidir lo que el servidor no puede decidir: dónde vive el secreto, cuándo
nace la cuenta, qué ve el usuario si se le pierde, y qué pasa sin red.

## Decisión

1. **El secreto vive en el llavero, nunca en SQLite.** `expo-secure-store` (Keychain en
   iOS, EncryptedSharedPreferences en Android). Es la única dependencia nueva y se
   justifica sola: un secreto de cuenta en la base que "Borrar todo y reiniciar" vacía, o
   en un backup sin cifrar, no es un secreto. La base guarda el id y el cursor; el
   llavero guarda el secreto.

2. **La cuenta nace cuando hace falta otra persona, no antes.** Crear el perfil del
   círculo sigue siendo local y sin red (regla 7). La app llama a `POST /account` la
   primera vez que el usuario **invita o usa un código**, que es el primer momento en que
   otra persona tiene que poder encontrarlo. Quien nunca invite a nadie nunca tendrá
   cuenta en ningún servidor, y eso es una promesa que la app puede cumplir.

3. **Es una clave de respaldo, no una frase.** ADR-0033 la llamó "frase"; llamarla así
   obliga a una lista de palabras de 2048 entradas en dos idiomas para ganar nada: el
   secreto ya es texto que se copia. La app muestra `id.secreto` en grupos legibles, con
   "Copiar", y dice en una línea qué se pierde sin ella. El camino real es el gestor de
   contraseñas, no el papel.

4. **La sincronía es del montón de `src/platform/`**, como Salud o las notificaciones:
   un módulo con `status()`, un hook en `platform/hooks/`, montado en `PlatformEffects`.
   Sincroniza al montar, al volver al frente, después de escribir algo del círculo, y
   como mucho cada cinco minutos. El cursor (`since`) vive en `settings`.

5. **Sin red no pasa nada.** Todo se escribe primero en SQLite y se sube después; un
   fallo de red no revierte nada, no muestra un error modal y no bloquea ninguna
   pantalla. `status().reason` dice que no se pudo sincronizar y cuándo fue la última vez
   que sí. Lo que el servidor rechaza (`rejected`) se borra de lo local, porque el
   servidor es la autoridad sobre lo que otra persona puede ver.

6. **El push cierra ADR-0037.** El token se registra con `POST /device` justo después de
   que exista cuenta y permiso, nunca antes. Lo que llega es silencioso: el teléfono
   compone la frase en su idioma y la pasa por el presupuesto de ADR-0027 —dos al día,
   nada de 22:00 a 8:00, **silencio absoluto en sesión y en pausa**— y descarta un
   empujón de más de un día. Sin permiso o sin token, el empujón aparece igual al
   sincronizar: no se compensa con nada.

7. **Borrar la cuenta es parte de Ajustes › Círculo**, con `DELETE /account`, y es
   distinto de "Salir del círculo". Borrar la cuenta borra el llavero y el cursor; la
   app vuelve a ser local y sigue funcionando entera.

## Precisiones que la implementación obligó a tomar

- **La cuenta se reclama al abrir "Invitar", no al tocar "Compartir".** El QR está vivo
  desde que la pantalla pinta y no hay gesto donde colgar el reclamo; un QR escaneable
  que devuelve 404 es peor que esperar un segundo. Mientras el servidor no confirme que
  el código es de esta cuenta, el QR no se dibuja. Abrir "Invitar" **es** necesitar a otra
  persona, así que el punto 2 se sostiene; quien se arrepienta después tiene "Borrar la
  cuenta" en Ajustes.
- **Lo que el servidor rechaza no se borra de SQLite**, contra lo que decía el punto 5:
  los ids rechazados se recuerdan y no se vuelven a subir, y ya. Borrar un reto rechazado
  destruiría el `habitId` del usuario, y una "marca rechazada" es una marca de un hábito
  suyo. El servidor manda sobre lo que otra persona ve, no sobre lo que el usuario guarda
  de sí mismo.
- **Un aviso del círculo tiene un solo interruptor**, no tres: empujón, solicitud y
  aceptación son el grupo "Círculo" de ADR-0027 §2, y la fila de Ajustes lo dice.

## Consecuencias

- El círculo deja de ser demostración y `platform/circle.status()` puede por fin decir
  que sí. La semilla del círculo se retira en la misma tanda.
- Una migración (009) para el cursor y el id de cuenta en `settings`.
- Reinstalar sin la clave pierde el círculo, y eso se dice en la pantalla donde se
  muestra, no en una nota al pie. Es el precio de no pedir correo (ADR-0033).
- Alternativas descartadas: lista de palabras estilo BIP39 (peso en el bundle y en dos
  idiomas, para un secreto que se copia); crear la cuenta al crear el perfil (rompería la
  promesa de que sin invitar a nadie nada sale del teléfono); resolver conflictos por
  fusión (cada fila tiene un dueño desde ADR-0033, así que no hay conflicto que fusionar).
