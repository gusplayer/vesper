# ADR-0048 — Una identidad sin login: saber quién es el usuario y devolverle lo suyo en otro teléfono

**Estado:** aceptada · 2026-09-25. El dueño del producto eligió el respaldo **encendido
por defecto** y **con las marcas de Salud dentro**. El punto 8 (correo de recuperación)
queda **propuesto** hasta que decida lo que ese punto le cuesta a la privacidad.

## Contexto

La pregunta fue si es momento de un login, si conviene tener los datos de los usuarios
y qué pasa cuando alguien pierde o cambia el teléfono. El caso que la hizo concreta: un
reto de gimnasio con amigos, tres veces por semana, sostenido tres meses, y un teléfono
perdido.

### Qué se perdía, el 2026-09-24

| Dato | Dónde vive | Teléfono nuevo |
|---|---|---|
| Estadísticas, meta semanal | Se derivan de `sessions`, en el teléfono | Perdido en Android siempre; en iPhone, solo vuelve si se restaura un backup completo |
| Racha | `sessions` + `grace_days`, en el teléfono | Igual |
| Hábitos y sus marcas | `habits`, `habit_marks`, en el teléfono | Igual |
| Círculo, retos | Servidor (`links`, `challenges`) | En el servidor, pero el teléfono nuevo no puede demostrar que es la misma persona |
| Las marcas propias de un reto | Servidor (`challenge_marks`) | Guardadas, y `/sync` nunca se las devolvía a su dueño |
| Apps de cada modo en iOS | Token opaco de Screen Time | Atado al dispositivo: nadie lo porta |

Tres defectos lo agravaban:

1. **Android no respaldaba la base.** `expo-secure-store` inyecta reglas de Auto Backup
   que solo incluyen preferencias, y una regla con `<include>` excluye todo lo demás:
   `databases/vesper.db` nunca salía del teléfono.
2. **La clave de respaldo del ADR-0044 solo salía.** Ajustes la muestra y la copia, pero
   ninguna pantalla la recibe ni ninguna ruta del servidor le devuelve el perfil a quien
   la tiene.
3. **`/sync` filtraba las marcas propias** (`marks.filter(mark.accountId !== me.id)`),
   así que ni con la clave volvían los tres meses de gimnasio.

### Lo que hacen los demás

- **Opal** tiene login (teléfono, correo, Apple) y aun así su ayuda dice que al
  reinstalar "any data (including Sessions, Milestones, Gems, or Streaks) … will be
  lost". Sus notas de versión llevan varias versiones prometiendo "Sign in with your
  last method, so reinstalling never loses your data", restauraron a mano las rachas de
  3500 personas tras una migración y limpian cuentas duplicadas.
- **Brick** exige correo, guarda en su servidor los modos, el tiempo en "Brick mode" y
  registros de sesión (en Android, con el nombre de cada app), y en un teléfono nuevo
  pide elegir otra vez las apps de cada modo. Su cuenta sirve al negocio —cinco
  desbloqueos de emergencia por persona, el ladrillo físico, la analítica—, no a la
  recuperación.
- Los bloqueadores puros (one sec, ScreenZen, Streaks) no piden cuenta para lo esencial.

Una cuenta no es una recuperación. Lo que se pierde es lo que no se respalda.

### Lo que dicen las tiendas y la ley

- App Store 5.1.1(v): una app sin funciones esencialmente de cuenta debe poder usarse sin
  login. 4.8: ofrecer Google obliga a ofrecer Sign in with Apple.
- Family Controls: lo que entrega el framework no sale del dispositivo (ADR-0004).
- Ley 1581 de 2012: los datos cercanos a salud son sensibles y piden autorización
  explícita; un correo es un dato personal con habeas data. Cuanto menos se guarda en
  claro, menos se debe.

## Decisión

1. **Sin login.** No hay pantalla de registro, ni correo obligatorio, ni contraseña.

2. **Una identidad por persona, anónima, que nace en el primer arranque.** La cuenta del
   ADR-0044 sube de rango: deja de ser "la cuenta del círculo" y pasa a ser la identidad
   de Vesper. Nace en silencio, sin pantalla, y se registra en el servidor cuando hay red;
   sin red la app funciona completa y la registra después. No lleva nombre ni alias hasta
   que el usuario entra al círculo. **Enmienda el punto 2 del ADR-0044 y la regla 7.**

3. **Lo que el servidor sabe de quien no usa el círculo:** el id, cuándo nació, cuándo se
   vio por última vez, la plataforma y la versión de la app. Es lo que responde "quién es
   el usuario": cuántos hay, cuántos vuelven, un id para soporte y, cuando exista la
   suscripción, el id de comprador en RevenueCat. Ningún correo, ningún nombre, ninguna
   sesión en claro.

4. **La identidad llega al teléfono nuevo por tres caminos**, del automático al manual:
   - **Automático, mismo sistema.** En iOS, el llavero de iCloud sincronizado
     (`kSecAttrSynchronizable`); en Android, Block Store, cifrado de extremo a extremo con
     el bloqueo de pantalla. `expo-secure-store` no expone ninguno de los dos, así que
     viven en un módulo local, `modules/vesper-identity/`, como `vesper-health`. Cubre el
     teléfono nuevo, el perdido y la reinstalación sin que el usuario haga nada. El número
     de teléfono no importa; importa la cuenta de Apple o de Google.
   - **La clave de respaldo** del ADR-0044, con la pantalla que faltaba para pegarla.
     Cubre el cambio entre iPhone y Android.
   - **El correo de recuperación** del punto 8, opcional.

5. **Restaurar rota el secreto.** El teléfono perdido o vendido todavía guarda el
   secreto viejo; restaurar es el momento de dejarlo fuera. `POST /account/secret`
   entrega uno nuevo una sola vez, invalida el anterior y borra el token de push, que
   apunta al teléfono viejo. La clave de respaldo cambia con él, y la pantalla lo dice.

6. **Lo social vuelve del servidor.** `GET /account` le devuelve el perfil a quien prueba
   que tiene la clave (nunca el hash del secreto ni el token de push), y `/sync` con
   `restore: true` agrega `own.marks`: todas las marcas propias en sus retos, sin mirar el
   cursor. Con ellas el teléfono rehace el hábito del reto y sus `habit_marks`.

7. **Lo personal vuelve de un respaldo cifrado en el teléfono.**
   - Una copia de la base (`VACUUM INTO`), cifrada con AES-GCM de `expo-crypto` 57, que ya
     lo trae: no hay dependencia nueva. La llave se deriva del secreto con una etiqueta
     propia, distinta del uso de autenticación, así que el servidor guarda algo que no
     puede leer.
   - Un blob por cuenta en el servidor, con tope de tamaño, que se borra con la cuenta.
     Años de uso caben en menos de un megabyte.
   - **Encendido por defecto**, con una línea en el onboarding y un interruptor en
     Ajustes que dice cuándo fue el último respaldo. Se sube al cerrar una sesión y como
     mucho una vez al día.
   - **Con las marcas de Salud dentro**, cifradas: sin ellas un reto de pasos o de
     gimnasio volvería incompleto. El texto del permiso de Salud pasa de "Nada sale del
     teléfono" a una frase que diga que sale solo cifrado.
   - Sin los tokens de Screen Time, que no sirven en otro aparato, y sin nada de
     `DeviceActivityReport`, que nunca se guardó (regla 10).
   - Al restaurar, el orden es: bajar el blob con las credenciales viejas, descifrarlo,
     rotar el secreto (punto 5) y volver a subirlo con la llave nueva.

8. **Propuesto: correo de recuperación, opcional.** En Ajustes, "Correo de recuperación":
   un código de seis dígitos lo verifica, y el mismo código lo usa para recuperar en
   cualquier teléfono y sistema. Cierra el único hueco de los puntos anteriores: teléfono
   perdido, cambio de sistema y ninguna clave guardada. **Lo que cuesta:** para que un
   correo solo baste, el servidor tiene que poder devolver el secreto, así que lo guarda
   cifrado con una llave del servidor que no vive en la base. Para quien active el
   correo, el respaldo deja de ser algo que solo él puede abrir, y la fila de Ajustes lo
   dice. Además: un proveedor de correo transaccional (un servicio externo nuevo), el
   correo declarado en las fichas de Apple y Google y en la privacidad (ADR-0046), y
   borrarlo al borrar la cuenta.

9. **Lo que no vuelve nunca, y se dice.** Los permisos se vuelven a pedir en su flujo
   (regla 8) y, en iOS, las apps de cada modo se vuelven a elegir. Después de restaurar,
   cada modo de iOS lo dice en su tarjeta en vez de no bloquear nada en silencio.

10. **Android respalda la base.** `plugins/withAndroidBackup.js` reemplaza las reglas de
    `expo-secure-store` (que corre con `configureAndroidBackup: false`): entran
    `database` y `sharedpref`; quedan fuera `SecureStore` (su llave del Keystore no viaja)
    y `vesper_blocking` y `vesper_windows`, que son estado de este teléfono y que el
    `BootReceiver` armaría en el nuevo antes de que JS los reconstruya.

## Fases

| Fase | Qué | Reglas que toca | Estado |
|---|---|---|---|
| A | Reglas de backup de Android (10); `GET /account`, `POST /account/secret` y `restore: true` en el servidor (5, 6); pantalla "Tengo una clave" y rehacer el reto con las marcas propias | Ninguna | Hecha |
| B | La identidad en el primer arranque (2, 3); `modules/vesper-identity` (4); "¿Ya usabas Vesper?" en el onboarding cuando encuentra una identidad | Regla 7, ADR-0044 §2 | Hecha; la regla 7 ya está reescrita |
| C | Respaldo cifrado (7) y el aviso de los modos de iOS (9) | Lista "No sale nunca" del ADR-0033, texto del permiso de Salud, ADR-0046 | Hecha |
| D | Correo de recuperación (8) | Regla 7, ADR-0046, fichas de las tiendas | Propuesta |

## Precisiones que la implementación obligó a tomar

- **Sin bloqueo de pantalla, el secreto no sube a la nube de Google.** Block Store sube
  la copia cifrada de extremo a extremo solo cuando hay bloqueo; sin él la subiría
  legible para Google, y como la llave del respaldo sale del secreto, Google podría abrir
  el respaldo. Así que en ese caso se queda en el teléfono (y en una transferencia
  directa entre teléfonos), `describe()` dice que no viaja y la pantalla pide un bloqueo o
  la clave.
- **Apagar el respaldo borra la copia del servidor** (`DELETE /backup`), no solo deja de
  subir copias nuevas. Sin red, se borra en la siguiente vuelta al frente.
- **El respaldo es JSON, no el archivo de la base.** No hace falta un módulo de archivos,
  cada tabla sale filtrada, y al restaurar se migra hasta el esquema del respaldo, se
  insertan las filas y se corren las migraciones que falten: un respaldo viejo se
  actualiza igual que se actualizaría el teléfono viejo. Uno de una versión más nueva de
  la app no se abre, y la pantalla pide actualizar.
- **Lo que no viaja en el respaldo:** los permisos concedidos (un permiso de otro teléfono
  no está concedido en este, regla 8), una sesión abierta (restaurada arrancaría un
  bloqueo en el teléfono nuevo), la identidad, el cursor del círculo y el estado del propio
  respaldo, y en iOS los tokens de Screen Time.
- **Una subida automática nunca pisa una copia más nueva que no escribió este teléfono**
  (por ejemplo, cuando el backup de Android trajo una base vieja). "Respaldar ahora" sí.
- **"Empezar de cero" borra la cuenta anterior** —su respaldo y su círculo— antes de que
  nazca la nueva, y lo confirma antes. Una identidad encontrada que el servidor ya no
  reconoce empieza de cero sola.
- **En iOS también hay una copia local**, en `expo-secure-store`, y se lee primero: dos
  iPhone con la misma cuenta de Apple comparten el llavero de iCloud, y sin la copia local
  el segundo pisaría la única clave del primero. La copia que viaja es la del último que
  escribió.
- **Una lectura de Salud reemplaza solo la semana que leyó.** Antes borraba todas las
  marcas de Salud en cada lectura, así que un hábito verificado solo conservaba la semana
  en curso y un respaldo no habría sobrevivido a la primera lectura. Ahora las marcas
  restauradas siguen siendo verificadas: convertirlas en manuales habría mezclado lo
  verificado con lo declarado (ADR-0005).
- **El servidor no guarda nada social de una identidad sin alias:** su `/sync` no escribe
  filas, nunca aparece como miembro, y canjear, aceptar o unirse a un reto le responde
  `409 handle required` hasta que reclame su perfil del círculo.
- **Si se pierde la respuesta del registro, ese id se abandona.** El servidor entrega el
  secreto una sola vez; un segundo `POST /account {id}` sin él es `401`, y el teléfono
  reserva un id nuevo. El registro gasta el tope de diez cuentas nuevas por hora por
  dirección: detrás de un NAT compartido puede tocar esperar, y la app no se bloquea.
- **`POST /device` sin `pushToken` ya no lo borra**, para que el aviso diario de
  plataforma y versión no le quite el push a quien tiene círculo.
- **El punto 9, con una lista.** Cada modo cuya selección se vacía —al exportar en iPhone,
  al importar en cualquier par que no sea Android a Android— queda en el ajuste
  `modes_repick`, que sí viaja; su tarjeta dice "Vuelve a elegir las apps" en vez de "No
  bloquea apps", hasta que se guarda una selección nueva o el modo se borra.
- **Una base que llega sin su clave.** El backup de Android trae la base —y con ella el
  registro de la identidad— pero nunca el secreto; sin bloqueo de pantalla, Block Store
  tampoco lo trae. Ese teléfono queda con una identidad registrada que no puede firmar:
  no respalda. Nada lo resuelve solo, porque una lectura fallida del llavero no puede
  costarle a nadie su cuenta. Ajustes › Respaldo lo dice ("Tus datos llegaron a este
  teléfono, pero tu clave no") y ofrece las dos salidas: "Tengo una clave" o "Empezar
  una identidad nueva", que conserva los datos, registra otro id y olvida el estado del
  respaldo anterior para que el primero salga en el acto. Lo mismo cubre el borde de un
  teléfono viejo que perdió su clave del círculo.

## Consecuencias

- La regla 7 de `CLAUDE.md` se reescribe cuando llegue la fase B: la identidad nace al
  arrancar, y lo personal viaja **solo cifrado**. La lista "No sale nunca" del ADR-0033
  sigue siendo cierta para lo que el servidor puede leer.
- El texto de privacidad (ADR-0046) y las fichas de datos de Apple y Google cambian
  **antes** de publicar la fase C, no después.
- El cifrado de extremo a extremo tiene un precio: quien pierda la identidad por los tres
  caminos pierde el respaldo. Quien pierde el teléfono, cambia de sistema, no guardó la
  clave y no dio un correo, lo pierde todo, y Ajustes lo dice.
- Rotar el secreto cambia la clave que el usuario haya copiado. Por los caminos
  automáticos la nueva viaja sola; si copió la vieja a un gestor, la pantalla le pide
  copiar la nueva.
- El servidor guarda blobs. Mientras quepan en Postgres con su tope, no hay almacenamiento
  aparte.

## Alternativas descartadas

- **Login obligatorio** (correo, Apple o Google). No resuelve la pérdida —Opal y Brick lo
  demuestran—, choca con 5.1.1(v), pone un muro en el primer minuto, que es donde se decide
  la conversión, y deja datos personales en claro que obligan a responder por ellos.
- **Sign in with Apple o Google como llave de recuperación.** Dos SDK, el par obligado
  de 4.8 y Apple incómodo en Android, para cubrir el mismo hueco que cubre un correo.
- **iCloud Drive o CloudKit en iOS más Drive `appDataFolder` en Android.** Dos
  implementaciones que no cruzan de sistema, y Drive pide iniciar sesión con Google.
- **Sincronizar en claro, fila por fila.** Hoy casi ninguna tabla tiene `updated_at` ni
  marcas de borrado: son más de cuarenta archivos, conflictos entre dispositivos que nadie
  pidió y una base de comportamiento que filtrar.
- **Una lista de palabras en vez de la clave.** El ADR-0044 ya la descartó.
