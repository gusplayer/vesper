# El servidor del círculo

Lo que decide el ADR-0033: cuentas por dispositivo, sincronía de filas con dueño y
entrega por Expo push. No entra al bundle de la app (`metro.config.js` bloquea esta
carpeta) y se despliega solo.

Desde el ADR-0048 la cuenta es además **la identidad de la persona**, sin login: nace en
el primer arranque con un id y un secreto, sin nombre ni alias, y de quien no usa el
círculo el servidor sabe solo eso, cuándo nació, cuándo la vio por última vez (con
resolución de una hora), la plataforma y la versión de la app. También guarda **un
respaldo por cuenta**: la base del teléfono cifrada en el teléfono con una llave derivada
del secreto. El servidor recibe bytes que no puede leer y no intenta mirarlos.

Desde el ADR-0050, de quien lo activa guarda además **un correo de recuperación** y una
copia de su secreto cifrada con `RECOVERY_KEY`, una llave que no vive en la base. Es lo
único que el servidor puede devolver: con el correo y un código, el secreto (abajo, "El
correo de recuperación").

Desde el ADR-0051 guarda además **las fotos de los retos, cifradas de extremo a extremo**:
filas con quién la subió, a qué reto y día, cuánto pesa y para quién va envuelta su
llave, y dos objetos en un bucket que no puede abrir. Las abre una sola vez, cuando un
participante la reporta y entrega la llave de esa foto (abajo, "Las fotos" y "Moderar un
reporte").

## Correrlo en local

```sh
npm install
npm run dev          # sin DATABASE_URL: todo en memoria, los push se registran y no salen,
                     # y los códigos de recuperación se imprimen en la consola
npm test             # 214 tests: dueño de la fila, cursor, código, identidad, respaldo,
                     # correo de recuperación, fotos, reportes, bloqueos, barrido y topes
npm run typecheck
```

Con `DATABASE_URL` apuntando a un Postgres, `npm start` aplica `src/schema.sql` al
arrancar (`create table if not exists` y guardas alrededor de cada `alter`, así que
correrlo dos veces no rompe nada) y los push salen de verdad por Expo.

## Variables de entorno

| Variable | Obligatoria | Qué hace |
|---|---|---|
| `DATABASE_URL` | Sí en producción | Sin ella el servidor corre en memoria y lo dice al arrancar. |
| `PORT` | No | `8787` por defecto. Railway la pone sola. |
| `DATABASE_CA_CERT` | No | El PEM de una CA privada, si algún día la base está detrás de una. **Neon no la necesita**: presenta un certificado de una CA pública (ISRG / Let's Encrypt) que Node ya trae. Si se define, se usa como único ancla de confianza. |
| `RESEND_API_KEY` | Para el correo de recuperación | La llave de la API de Resend, con permiso de envío. Sin ella las rutas `/recovery` responden `503 email not configured`. |
| `RECOVERY_FROM` | Para el correo de recuperación | El remitente, en una dirección de un dominio **verificado en Resend** (un `*.vercel.app` no sirve): `Vesper <codigo@tudominio.com>`. Sin ella, `503`. |
| `RECOVERY_KEY` | Para el correo de recuperación | 32 bytes en base64: la llave con la que se cifra la copia de cada secreto y con la que se firman los códigos. Se genera una vez con `openssl rand -base64 32`. Sin ella, o con otro largo, `503`. **No se puede perder ni cambiar**: sin la misma llave, las copias no se abren y todo el que tenía correo tiene que confirmarlo de nuevo. Vive en las variables de Railway y en ningún otro lado del repositorio. |

| `AWS_ENDPOINT_URL`, `AWS_S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Para las fotos | El bucket de las fotos (ADR-0051). Son las variables que inyecta el preset **"AWS SDK"** de un Railway Bucket (pestaña *Variables* del bucket → conectar al servicio con ese preset). Sin alguna de las cuatro: en local (sin `DATABASE_URL`) los objetos viven en memoria y el arranque lo dice; con `DATABASE_URL`, las fotos quedan apagadas y `/media` responde `503 photos not configured`. |
| `AWS_DEFAULT_REGION` | No | `auto` por defecto, que es lo que usa Tigris (Railway). |
| `AWS_S3_URL_STYLE` | No | `virtual-hosted` por defecto (`https://<bucket>.t3.storageapi.dev/<llave>`), que es lo que usan los buckets nuevos de Railway. Un valor que empiece por `path` firma `https://<endpoint>/<bucket>/<llave>`: buckets viejos de Railway (la pestaña *Credentials* dice cuál) o MinIO. |
| `MEDIA_PREFIX` | No | Un prefijo para todas las llaves del bucket (`staging/`), por si dos entornos comparten uno. Vacío por defecto. |
| `ADMIN_TOKEN` | Para moderar | El token de las rutas `/admin/*`, de al menos 32 caracteres (`openssl rand -base64 32`). Sin él, o más corto, esas rutas responden 404 como si no existieran. Vive en las variables de Railway y en el gestor de contraseñas de quien modera. |

Sin `DATABASE_URL` (en local) no hacen falta las tres: el correo se reemplaza por uno que
imprime `recovery code for <correo>: <código>` en la consola, y la llave es aleatoria y
dura lo que dura el proceso, como todas las filas. Con `DATABASE_URL`, el arranque dice
en una línea si el correo está activo o qué variable falta, sin imprimir nunca un valor:
`email recovery off (RESEND_API_KEY, RECOVERY_FROM not set): /recovery answers 503`.

El bucket y la moderación también lo dicen al arrancar, en una línea cada uno y sin
valores:

```
photos in bucket vesper-photos-x1y2 at t3.storageapi.dev (virtual-hosted, region auto)
photos on memory (AWS_ENDPOINT_URL, AWS_S3_BUCKET_NAME, … not set): objects are lost on restart, URLs are served by /media-local
photos off (AWS_ENDPOINT_URL, AWS_S3_BUCKET_NAME, … not set): /media answers 503
moderation on: /admin takes ADMIN_TOKEN
moderation off (ADMIN_TOKEN not set): /admin answers 404
```

La conexión a Postgres **verifica el certificado y el nombre del host** (`ssl: true` llega
tal cual a `tls.connect`). Nunca `rejectUnauthorized: false`: eso deja el tráfico cifrado
contra quien escucha y abierto de par en par contra quien responda en lugar de la base, y
la cadena de conexión lleva su propia contraseña adentro. Los parámetros `ssl*` que vengan
en la URL se descartan antes de abrir el pool, porque node-postgres los aplica **después**
de las opciones y un `?sslmode=no-verify` heredado del botón de copiar de un proveedor
desharía la decisión en silencio.

## Dónde está desplegado

- **Railway**, proyecto `vesper`, servicio `circle-api`, entorno `production`.
  Raíz del build `/server`, arranque `npm start`, healthcheck `/health`.
  Se redespliega solo con cada push a `main`.
- **Neon**, proyecto `vesper` (`snowy-lake-14790843`), región `aws-us-east-1`,
  base `neondb`.
- **URL**: `https://circle-api-production.up.railway.app`

`DATABASE_URL` vive en las variables del servicio en Railway y **no se guarda en el
repositorio**. Si hay que rotarla, se saca de la consola de Neon y se pone ahí.

### Qué pasó en el último despliegue (2026-09-25)

Nada a mano. `src/schema.sql` corre al arrancar y ahora agrega `unique` sobre
`invite_code` dentro de una guarda (`pg_constraint`), así que es idempotente y no hay
migración que lanzar. Si la base ya tuviera dos cuentas con el mismo código —la de
producción está vacía desde el 2026-09-24—, la más antigua se lo queda y a las otras se les pone
en null antes de crear la restricción, para que el `alter` no tumbe el arranque. Perder el
código no pierde nada: el teléfono deriva el siguiente subiendo su generación.

Con el ADR-0048, el arranque además hace esto, todo idempotente:

- `accounts.name` y `accounts.handle` dejan de ser `not null` (`alter column … drop not
  null`). Las cuentas que ya existen conservan su nombre y su alias; solo las nuevas
  pueden nacer sin ellos. `handle` sigue siendo `unique`, y Postgres cuenta los null como
  distintos, así que las identidades sin alias conviven.
- `accounts` gana `platform`, `app_version` y `last_seen_at` con `add column if not
  exists`, en null para las filas viejas. Sin `check` en el `alter`: algunas versiones de
  Postgres vuelven a agregar la restricción en cada corrida aunque la columna ya exista;
  la API valida `platform`.
- Se crea `backups` con `create table if not exists`, una fila por cuenta y
  `on delete cascade` hacia `accounts`.

Probado contra un Postgres 17 local: el esquema viejo, una cuenta con alias, y el nuevo
corrido dos veces encima.

No hay variables nuevas obligatorias. `DATABASE_CA_CERT` existe pero se deja sin definir
con Neon.

### Qué hace el próximo despliegue (ADR-0050)

Nada a mano en la base. El arranque crea dos tablas nuevas con `create table if not
exists`, las dos con `on delete cascade` hacia `accounts`, y dos índices con `create
index if not exists`; no toca ninguna tabla que ya exista:

- `recovery`: una fila por cuenta que confirmó un correo. `email` es `unique`.
- `recovery_codes`: los códigos vivos, con clave `(purpose, subject)`.

Probado contra un Postgres 17 local: el esquema desplegado con una cuenta adentro, y el
nuevo corrido dos veces encima.

Lo que sí hay que hacer, en las variables del servicio en Railway y antes o después del
despliegue: `RESEND_API_KEY`, `RECOVERY_FROM` y `RECOVERY_KEY`. Mientras falte alguna,
el servidor arranca igual y las rutas `/recovery` responden `503`, que la app muestra
como "todavía no está disponible".

### Qué hace el próximo despliegue (ADR-0051)

Nada a mano en la base. El arranque, todo idempotente:

- `accounts` gana `box_key`, `box_key_id` y `banned_at`, en null para las filas que ya
  existen; `challenges` gana `photos boolean not null default true` (los retos que ya
  existen quedan con fotos, que es lo que los teléfonos suponían).
- Crea `media`, `reports` y `blocks` con `create table if not exists`, y sus índices con
  `create index if not exists`. `media` y `blocks` van en cascada hacia `accounts` (y
  `media` hacia `challenges`); `reports` no, a propósito (abajo).

Probado contra un Postgres 17 local: el esquema de `HEAD` con una cuenta y un reto, y el
nuevo corrido dos veces encima (las restricciones no se duplican y el reto queda con
`photos = true`). Además, los 45 tests de fotos y los de la API corrieron una vez contra
ese Postgres en vez de la memoria, y un recorrido con `curl` contra el proceso real.

Lo que sí hay que hacer en Railway, antes o después del despliegue:

1. Crear un **Bucket** en el proyecto `vesper` y conectarlo al servicio `circle-api`
   con el preset **AWS SDK**. Eso pone las cinco `AWS_*` (más `AWS_S3_URL_STYLE`).
2. Poner `ADMIN_TOKEN`.

Mientras falte el bucket, en producción las fotos quedan **apagadas**: `POST /media`,
los `PUT` y `GET /media/:id/url` responden `503 photos not configured`, y el teléfono
deja la foto en su cola y la manda cuando el bucket exista. Guardarlas en memoria con
una base real dejaría, después de cada reinicio, filas `ready` que apuntan a objetos que
ya no están. En local (sin `DATABASE_URL`) todo sigue en memoria, como el resto.

## La API, en corto

Todo menos `POST /account`, `GET /health`, `POST /recovery/start` y
`POST /recovery/finish` necesita `Authorization: Bearer <id>.<secreto>`.

| Verbo | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Responde `{"ok":true}`. Es el healthcheck de Railway. |
| POST | `/account` | Crea la cuenta (el teléfono elige el id, que es un UUID v7; el servidor entrega el secreto **una sola vez**) o actualiza nombre, alias y código de invitación. Sin `inviteCode` en el cuerpo, el código que ya tenía se queda como está; con `null`, lo suelta. Con `{ id }` solo, sin `Authorization`, nace una identidad sin círculo: `201 { id, secret, handle: null }` (ADR-0048). Nombre y alias van juntos o no van (uno solo es `400`), y un código sin ellos también es `400`. Con el secreto, el mismo cuerpo `{ id }` responde `200 { id, handle }` sin escribir nada, y `{ id, name, handle }` reclama el perfil del círculo de una identidad. |
| GET | `/account` | El perfil propio (nombre, alias, código, zona, interruptor de empujones), para un teléfono que acaba de restaurar con la clave de respaldo. Nunca el hash del secreto ni el token de push (ADR-0048). Además `lastSeenAt` (la última vez que se vio la cuenta **antes** de esta petición, con resolución de una hora, o null), `platform` (`ios`, `android` o null) y `recoveryEmail` (el correo confirmado o null): con eso la bienvenida de un segundo dispositivo sabe si el Vesper que encontró sigue en uso (ADR-0050 §9). |
| POST | `/account/secret` | Rota el secreto: entrega uno nuevo **una sola vez**, el viejo deja de servir y el token de push se borra, porque apunta al teléfono anterior. Se llama al restaurar (ADR-0048). Si la cuenta tiene correo de recuperación, vuelve a cifrar la copia con el secreto nuevo; si el servidor no tiene `RECOVERY_KEY`, borra el correo, porque una copia de un secreto muerto es peor que ninguna. También borra la llave de caja (ADR-0051), que salió del secreto viejo: el teléfono publica la nueva en `POST /device`. 10 por hora por cuenta. |
| DELETE | `/account` | Borra la cuenta y todas sus filas, el respaldo y el correo de recuperación incluidos, y del bucket `m/<id>/` y las fotos de los retos que hizo (ADR-0051). Un reporte sobre una foto suya se queda hasta que se resuelve. |
| POST | `/device` | Token de push, zona horaria, interruptor de empujones, `platform` (`ios` o `android`), `appVersion` (1 a 32 caracteres ASCII imprimibles) y `boxKey` (la llave pública de caja, 32 bytes en base64; ADR-0051). Todo es opcional y **lo que no viene se queda como estaba**; `pushToken: null` es lo que retira el token, y `boxKey: null`, la llave. |
| PUT | `/backup` | Sube el respaldo cifrado: bytes crudos (`application/octet-stream`), hasta 5 MB (`413 backup too large`, primero por `Content-Length` y después contando los bytes). Exige `X-Backup-Format` y `X-Backup-Schema` (enteros positivos) y `X-Backup-Platform` (`ios` o `android`); sin ellos, o con el cuerpo vacío, `400`. Reemplaza el anterior y responde `{ updatedAt, size }` (ADR-0048). |
| GET | `/backup` | Los bytes tal como llegaron, con `X-Backup-Format`, `X-Backup-Schema`, `X-Backup-Platform` y `X-Backup-Updated-At`. `404 no backup` si no hay. |
| GET | `/backup/meta` | `{ updatedAt, size, schema, platform, format }` sin los bytes, o `404 no backup`. |
| DELETE | `/backup` | Borra la copia y deja la cuenta: es lo que hace apagar el respaldo en Ajustes. `204` haya o no copia (ADR-0048 §7). |
| POST | `/invite/redeem` | Usa el código de otra persona: queda pendiente de que acepte. Entre dos personas con un bloqueo, en cualquier sentido, responde `404 unknown code`, como un código que no existe. |
| POST | `/invite/accept` | Acepta a quien usó tu código; el vínculo queda en los dos sentidos. |
| POST | `/challenge/join` | Entra a un reto de alguien de tu círculo. |
| POST | `/link/end` | Termina el vínculo con `memberId` en los dos sentidos, sea cual sea su estado (Rechazar, Quitar), o con todos si el cuerpo trae `everyone: true` (Salir del círculo). Cada uno sale de los retos que hizo el otro, y sus fotos en ellos pasan a lápida (ADR-0051). Responde 200 aunque no hubiera vínculo; un 404 solo puede venir de un servidor sin esta ruta (ADR-0049). |
| POST | `/challenge/leave` | Sale de un reto: el llamante deja de ser participante, nadie lo ve en él ni puede empujarlo en él, y sus fotos en él pasan a lápida (ADR-0051). Responde 200 aunque ya hubiera salido (ADR-0049). |
| POST | `/recovery/email` | `{ email, locale }` → `202 { sent: true }`: manda un código de seis dígitos a ese correo para confirmarlo. `locale` es `es` o `en` (otro valor, español). `400 bad email`; `502 email not sent` si Resend no tomó el mensaje. 5 por hora por cuenta (ADR-0050). |
| POST | `/recovery/email/verify` | `{ code }` → `200 { email }`. Guarda el correo como confirmado y una copia cifrada del secreto de **esta misma petición** (el de su `Authorization`). Si otra cuenta tenía ese correo, lo pierde. `400 wrong code`, `410 code expired`, `429 too many attempts` después de cinco equivocados. |
| DELETE | `/recovery/email` | Borra el correo, la copia del secreto y los códigos vivos. `204` haya o no. Funciona aunque el correo no esté configurado: quitar un dato propio no espera a un proveedor. |
| POST | `/recovery/start` | Sin `Authorization`. `{ email, locale }` → **siempre** `202 { sent: true }`, tenga o no una cuenta ese correo; el mensaje sale solo si es un correo confirmado. `400 bad email` solo por la forma. |
| POST | `/recovery/finish` | Sin `Authorization`. `{ email, code }` → `200 { id, secret }`, el secreto con el que el teléfono abre el respaldo y sigue la restauración de siempre. `400 wrong code` para un código equivocado **y** para un correo que nadie tiene; `410 code expired`; `429 too many attempts`. |
| POST | `/sync` | Sube lo que el llamante posee y baja lo que cambió en su círculo desde `since`. Devuelve `now` como próximo cursor y `rejected` con lo que no pasó las reglas. Con `restore: true` agrega `own.marks`: todas las marcas propias en los retos del llamante, sin mirar el cursor (ADR-0048), y `own.media`: sus fotos vivas (ADR-0051). Además `media` y `keys` (abajo, "Las fotos"), y cada reto lleva `photos`. |
| POST | `/media` | Una foto de un reto (ADR-0051): la fila y las envolturas, antes de los bytes. `201 { id, expiresAt }` (`200` si es el mismo id otra vez). Abajo, "Las fotos". |
| PUT | `/media/:id/thumb`, `/media/:id/full` | Los bytes cifrados, crudos, del tamaño exacto anunciado (100 KB y 1,5 MB como tope). `{ id, state }`, con `state` en `ready` cuando llegaron los dos. |
| GET | `/media/:id/url?variant=thumb\|full` | `{ url, expiresAt }`: una URL firmada de 5 minutos, directa al bucket. Solo el dueño o alguien con envoltura que siga en el reto. |
| DELETE | `/media/:id` | El dueño la borra: lápida y objetos. `200` aunque no exista. |
| POST | `/report` | `{ mediaId, reason, note?, contentKey }` → `200 { ok: true }`. Abajo, "Reportes". |
| POST | `/block` | `{ memberId }` → `200 { ok: true }`. Termina el vínculo como `/link/end` y, desde ahí, un código entre los dos es un código que no existe. |
| GET | `/media-local/:token` | Solo con el bucket en memoria: los bytes de una URL "firmada", sin `Authorization`. El token es aleatorio y vence a los 5 minutos. |
| GET, POST | `/admin/*` | Moderación, con `Authorization: Bearer <ADMIN_TOKEN>`. Abajo, "Moderar un reporte". |

`/sync` devuelve además `ended`: los ids de las personas cuyo vínculo con el llamante
terminó después de `since` (ADR-0049). Una fila borrada nunca vuelve sola por el cursor,
así que el fin se guarda por par en `ended_links` hasta que un vínculo nuevo lo reemplaza.

En `weeks`, **null es "no lo comparte"**, nunca cero: cero diría que esa persona no hizo
nada esa semana, que es otra cosa. Los tres interruptores de Ajustes › Círculo (foco,
hábitos, uso de redes) llegan aquí como nulls.

Cada escritura se fuerza al llamante: una semana es suya, una marca es suya, el ánimo y
el empujón salen de él. Nada confía en un id que venga en el cuerpo.

Cada llamada autenticada anota `last_seen_at` si la última vez fue hace una hora o más:
una escritura por hora por cuenta, no una por llamada.

## Una identidad sin círculo

Una cuenta con `handle` en null (ADR-0048) **no tiene nada social**, y eso lo decide el
servidor, no el teléfono:

- Nunca aparece en `members` de nadie, aunque una fila de `links` dijera otra cosa.
- `/invite/redeem`, `/invite/accept`, `/challenge/join`, `POST /media`, los `PUT` y la
  URL de una foto, `/report` y `/block` le responden
  `409 { "error": "handle required" }` antes de mirar nada. Un push nombra a su remitente
  por alias, y un reto muestra alias: sin alias no hay qué mostrar.
- `/sync` le responde, pero no escribe ninguna fila de su cuerpo (semanas, retos, marcas,
  ánimos, empujones): el servidor no guarda totales de quien no usa el círculo.
- Para entrar al círculo, el teléfono manda `POST /account` con su secreto, `name` y
  `handle`, con las mismas reglas de siempre (alias único, `409 handle taken`).

## El respaldo

Un blob por cuenta en `backups`, que se reemplaza en cada subida y se va con la cuenta.
Son bytes cifrados en el teléfono con una llave derivada del secreto, con una etiqueta
distinta de la que autentica: **el servidor no puede leerlos**, y no los abre, no los
valida ni los escribe en los logs. Lo único que lee son las tres cabeceras, que son lo que un
teléfono nuevo necesita para saber, antes de bajar nada, si puede abrirlos. Años de uso
caben en menos de un megabyte; el tope de 5 MB es la línea en la que el blob dejaría de
caber bien en Postgres.

## Lo que el servidor no deja pasar

**El código de invitación es de una sola cuenta.** `invite_code` es `unique`: la primera
cuenta que lo reclama se lo queda y la segunda recibe `409 invite code taken`. Además el
servidor comprueba que el código **se derive del id de la cuenta** (`src/invite.ts` es el
`inviteCodeFor` del teléfono, portado), así que un código visto en un QR, en un pantallazo
o en un link `/join?code=` no se puede registrar como propio. Las dos cosas juntas, porque
la derivación es FNV-1a y no una firma: con paciencia se muele un UUID que caiga en un
código ajeno, y ahí lo que decide es la unicidad.

Esto le pide **dos cosas al cliente** cuando se escriba `src/platform/circleApi.ts`:

1. El id de la cuenta es el id del perfil del círculo (`profile.id`, el UUID v7 que ya
   existe). Si fueran distintos, el servidor rechazaría todos los códigos con
   `400 inviteCode does not derive from this id`.
2. Un `409 invite code taken` significa "alguien más tiene ese código": el teléfono sube
   `codeGeneration` (que es lo que ya hace "Generar código nuevo") y vuelve a intentar.
   Además puede mandar `codeGeneration` en el cuerpo y la comprobación es exacta.

**Ids.** Todo id que elige el cliente —cuenta, reto, ánimo, empujón— tiene que ser un
UUID v7 como el de `src/lib/uuid.ts`. Una fila con un id inventado se ignora; un id de
cuenta con otra forma es `400`. `name` llega hasta 40 caracteres, el nombre de un reto
hasta 60, la zona horaria es un nombre IANA y un sync trae como máximo 500 filas de cada
tipo.

**El alias se puede enumerar, y se acepta.** `POST /account` responde `409 handle taken`
cuando el alias es de otra persona, y eso permite preguntar de a uno cuáles existen. Se
deja así porque un alias es público por diseño —es lo que un reto muestra en vez del
nombre (ADR-0032 §4)— y porque sin esa respuesta la app no puede decirle al usuario por
qué no se pudo crear la cuenta. Lo que se responde es "ese alias existe" y nada más: ni
nombre, ni código, ni si esa persona está en algún círculo. El tope por dirección (abajo)
es lo que evita que preguntar de a uno se convierta en una lista.

**Topes.** Contadores en memoria, por ventana de una hora. **El servicio corre en una
sola instancia**; si algún día corre en dos, cada una lleva su cuenta y los topes se
duplican, y ese día se mueven a Postgres. No se disfrazan de distribuidos.

| Qué | Tope | Por qué |
|---|---|---|
| `/invite/redeem` | 10 por cuenta, 30 por dirección | Un código son seis símbolos de un alfabeto de 32: 32⁶ ≈ 1.070 millones. A esta velocidad, llegar a una probabilidad de 1 % sobre un código concreto toma unos cuarenta años. Quien fue invitado de verdad escribe uno. |
| `POST /account` | 30 por dirección; 10 si son cuentas nuevas | Cada cuenta nueva es una identidad más para adivinar, y es lo que hace falta para enumerar alias. Una identidad sin alias gasta el mismo tope: con el secreto puede reclamar uno después. |
| `/invite/accept`, `/challenge/join`, `/device` | 60 por cuenta | Son toques de dedo. |
| `/sync` | 180 por cuenta | Uno cada veinte segundos, más de lo que la app pide. |
| `POST /media` | 60 por cuenta | Una foto por reto y día, reemplazable: cinco retos y algunas dudas. |
| `PUT /media/:id/*` | 120 por cuenta | Dos por foto. |
| `GET /media/:id/url` | 1200 por cuenta | Una por objeto: el álbum de un reto de doce personas y tres semanas son unas 250 miniaturas, que el teléfono guarda. |
| `DELETE /media/:id` | 60 por cuenta | Un toque. |
| `POST /report` | 20 por cuenta | Se espera cero (ADR-0051). |
| `POST /block` | 60 por cuenta, con `/link/end` y `/challenge/leave` | Un toque. |
| Token de admin equivocado | 20 por dirección | El token es largo; esto lo mantiene así. |
| `POST /account/secret` | 10 por cuenta | Un teléfono nuevo rota una vez, al restaurar. |
| `PUT /backup` | 30 por cuenta | El teléfono sube al cerrar una sesión y como mucho una vez al día; cada subida puede pesar 5 MB. |
| `GET /backup` | 30 por cuenta | Un teléfono nuevo baja una vez, dos si falla el descifrado; son 5 MB por llamada. `GET /backup/meta` no tiene tope propio: no trae bytes. |
| `POST /recovery/email` | 5 por cuenta | Una persona escribe un correo, dos si se equivocó. Se cuenta después de revisar la forma: un correo mal escrito no gasta. |
| `POST /recovery/start` | 10 por dirección, 5 por correo | Nadie inició sesión, así que se cuenta por dirección y por el correo pedido, exista o no, para que el tope no diga cuál existe. |
| `POST /recovery/finish` | 30 por dirección | Cada código ya muere a los cinco intentos; esto es una dirección probando muchos correos. |
| Correos a una misma dirección | 10 por día | Sumando las dos rutas que mandan. Vesper no sirve para llenarle el buzón a nadie, y limita a diez códigos por día las adivinanzas sobre un correo. |
| Push de una persona a otra | 5 por par | La fila del empujón siempre se guarda; lo que tiene presupuesto es el push. Sin esto, resincronizar el mismo empujón despierta el teléfono ajeno una y otra vez. |

Un tope que se pasa responde `429` con `Retry-After`. Un código quemado por intentos
responde `429 too many attempts`, sin `Retry-After`: lo que sirve ahí es pedir otro.

## El correo de recuperación

El ADR-0050 acepta el precio del punto 8 del ADR-0048: para que un correo solo baste, el
servidor tiene que poder devolver el secreto. Lo hace así:

- **La copia del secreto** se cifra con AES-256-GCM, con `RECOVERY_KEY` como llave y el
  id de la cuenta como dato autenticado, y se guarda como base64(iv | cifrado | etiqueta).
  Una copia de la base sola no abre nada, y una copia movida a la fila de otra cuenta
  tampoco. Se toma del `Authorization` de la petición que confirma el correo, y se vuelve
  a cifrar cada vez que el secreto rota.
- **Los códigos** son seis dígitos de `crypto.randomInt`, duran diez minutos y aguantan
  cinco intentos equivocados; el sexto responde `429` y el código queda quemado hasta que
  vence o se pide otro. Hay uno vivo por `(propósito, sujeto)` y uno nuevo reemplaza al
  anterior. Se guardan como HMAC-SHA256 con una llave derivada de `RECOVERY_KEY` y con el
  propósito y el sujeto adentro: seis dígitos son un millón de valores, y un hash sin
  llave se revierte en un segundo con la tabla en la mano. El intento se cuenta en la
  misma sentencia que revisa el tope, así que cinco adivinanzas en paralelo cuentan
  cinco.
- **Nada dice si un correo existe.** `/recovery/start` escribe una fila de código para
  cualquier correo que pida, exista o no una cuenta con él (en ese caso con `account_id`
  en null y sin mandar nada), y no espera a Resend para responder. Así `/recovery/finish`
  recorre el mismo camino para un correo conocido y uno desconocido: cinco `400`, un
  `429`, y `410` cuando vence, con los mismos cuerpos y las mismas consultas a la base.
  Los códigos vencidos se borran un día después, cuando alguien pide uno nuevo.
- **Un correo, una cuenta.** `recovery.email` es `unique`, y confirmar un correo que ya
  usa otra cuenta se lo quita a esa, dentro de una transacción.
- **El mensaje** es solo texto, en español o en inglés según pida el teléfono: el código,
  "Vence en 10 minutos." y "Si no lo pediste, ignora este correo." Sin HTML, así que sin
  píxel de seguimiento, y sin enlaces.

Si alguna vez `RECOVERY_KEY` cambia, `/recovery/finish` responde `500 escrow unreadable`
con el código correcto y el log lo dice; la persona tiene que confirmar su correo de
nuevo desde un teléfono que todavía tenga la clave.

## Las fotos

El ADR-0051: una foto opcional por persona, por reto y por día, en la celda de ese día,
cifrada de extremo a extremo. El servidor guarda bytes que no puede abrir, los borra 14
días después del cierre del reto (28 por foto en un reto sin fin) y no avisa nada: llegan
con la sincronía de siempre.

**La llave de caja.** Cada identidad publica en `POST /device` su llave pública X25519
(`boxKey`, 32 bytes en base64), derivada en el teléfono del secreto con una etiqueta
propia; el servidor guarda `SHA-256(secreto)` sin etiqueta y no puede derivarla.
`box_key_id` son los primeros 8 bytes de `SHA-256(llave)` en hex: el nombre con que una
envoltura dice para qué llave se hizo. `boxKey: null` la retira. Al rotar el secreto
(`POST /account/secret`) la llave se borra, porque salió del secreto viejo, que el
teléfono perdido todavía tiene: el teléfono nuevo publica la suya enseguida.

**La vida de una foto.**

1. `POST /media` con `{ id, challengeId, dayKey, width, height, origin: 'camera'|'library',
   epk, captionBox|null, wraps: [{ recipientId, keyId, box }], thumbSize, fullSize }`. El
   servidor comprueba: alias (`409 handle required`), cuenta no vetada (`403 banned`),
   UUID v7, participante del reto (`403`), `photos` encendido (`409 photos off`), día del
   reto y reto sin archivar (`409 not a day of that challenge`), y que `dayKey` esté a dos
   días o menos de su fecha UTC (`400`; lo estricto, hoy o ayer, lo dice el teléfono).
   Después, que el dueño tenga llave (`409 box key required`) y que las envolturas
   **cubran a cada participante con llave, con la llave que tiene ahora, el dueño
   incluido**. Si no, `409 { error: 'stale keys', keys: [{ id, boxKey, keyId }] }` con las
   llaves de todos los que hay que cubrir, y el teléfono vuelve a envolver. Una envoltura
   para alguien fuera del reto, o bloqueado con el dueño, se descarta. Hasta 13.
2. La fila nace `pending` y no le llega a nadie. `PUT /media/:id/thumb` y `/full` suben los
   bytes; cuando están los dos pasa a `ready`, sube su `updated_at` y entra en la sincronía
   de los demás. Otra foto del mismo día le pone lápida a la anterior y borra sus objetos.
3. `GET /media/:id/url` da la URL firmada, en JSON y nunca como 302: `fetch` puede
   reenviar `Authorization` en una redirección y S3 rechaza una petición firmada dos
   veces. El teléfono baja esa URL **sin** `Authorization`.
4. Borrarla (`DELETE`), otra del mismo día, salir del reto, terminar un vínculo, bloquear,
   que un moderador la quite o que venza: **lápida** (`deleted_at`), que viaja por el
   cursor como cualquier cambio, y los objetos se borran en el acto.

**Qué baja en `/sync`.** `media: RemoteMedia[]`, las filas cambiadas desde el cursor que
el llamante puede ver: las suyas, y las que tienen envoltura para él mientras siga en el
reto y no haya un bloqueo entre él y el dueño; `ready` o con lápida. Las lápidas le
llegan a todo el que tuvo envoltura, esté o no en el reto: solo dicen "ya no está".

```ts
type RemoteMedia = {
  id: string; challengeId: string; ownerId: string; dayKey: string;
  width: number; height: number; origin: 'camera' | 'library';
  epk: string; captionBox: string | null;       // null en una lápida
  wrap: { keyId: string; box: string } | null;  // la del llamante; null en una lápida
  createdAt: number; updatedAt: number; expiresAt: number; deletedAt: number | null;
};
```

`keys: [{ id, boxKey, keyId }]`, siempre enteras y sin mirar el cursor: la propia, las de
su círculo y las de todos los participantes de sus retos sin archivar (un reto junta a
dos personas que están cada una en el círculo del creador y no en el de la otra).

**Cuándo vence.** `expiresAt` es la medianoche local que termina el último día que se
guarda: el día 14 después del último día del reto, o el 28 después del día en que se
compartió en un reto sin fin (el instante es el comienzo del día 15, o del 29), en la zona
horaria que el dueño mandó en `POST /device` (UTC si nunca mandó una). Es la misma cuenta
que `photoExpiresAt` en el teléfono, y la pantalla nombra el día anterior a ese instante.

**Qué pasa sola.** Cada hora, en el mismo proceso (`src/sweeper.ts`): lo vencido pasa a
lápida y sus objetos se borran; una subida que lleva un día en `pending` se borra entera
(un `PUT` después responde 404 y el teléfono empieza de nuevo); las lápidas de más de 60
días se olvidan; lo preservado de más de un año se borra; un reporte resuelto sin
preservar se olvida a los 60 días. Cada semana (la primera, una hora después de
arrancar), la conciliación borra todo objeto del bucket que no tenga una fila viva que lo
quiera. Es la red debajo de cualquier borrado que falló a medias.

**Borrar la cuenta** borra `m/<id>/` y los objetos de las fotos de los retos que la cuenta
hizo (sus filas se van en cascada con el reto). Los demás teléfonos no se enteran (ADR-0049):
cada uno vence sus copias por su cuenta.

**Bloquear** (`POST /block { memberId }`) termina el vínculo como `/link/end`, saca a cada
uno de los retos del otro con sus fotos, y guarda el bloqueo. Desde ahí, `/invite/redeem`
entre los dos responde `404 unknown code`, en los dos sentidos. En el reto de una tercera
persona los dos siguen, pero no se ven las fotos, no se empujan y no hace falta
envolverse. No se le avisa a nadie.

### Reportes

`POST /report { mediaId, reason: 'unwanted'|'consent'|'minor'|'other', note?, contentKey }`.
`contentKey` es la llave de **esa foto** (32 bytes en base64), nunca otra. El servidor abre
con ella la miniatura guardada (AES-256-GCM, `nonce(12) | cifrado | etiqueta(16)`, dato
autenticado `vesper-photo-v1|<mediaId>|thumb`): si no abre, `400 wrong key`. La etiqueta
prueba a la vez que la llave es la buena y que los bytes son los que subió el dueño.

Solo reporta alguien para quien la foto fue envuelta (si no, `404`). Un segundo reporte de
la misma persona sobre la misma foto responde igual y no escribe nada. Al llegar, los dos
objetos se **copian a `r/<reportId>/`**: que el dueño la borre o que venza no se lleva la
evidencia antes de que alguien la mire. Nadie ve quién reportó, tampoco quien modera; la
fila lo guarda solo para lo anterior y lo pierde si esa cuenta se borra.

Un reporte **sobrevive a la foto y a la cuenta del dueño**, a propósito: lo reportado a
NCMEC se conserva un año. Por eso `reports` no va en cascada hacia `media` ni hacia la
cuenta del dueño.

## Moderar un reporte

La guía 1.2 de Apple y la política de Google piden actuar sobre un reporte **en menos de
24 horas**. Un reporte deja una línea en el log de Railway (`report <id> on a photo
(<motivo>): /admin/reports`), sin nada de quién ni de qué. El proceso, una vez al día como
mínimo y cada vez que aparezca esa línea:

```sh
API=https://circle-api-production.up.railway.app
ADMIN="Authorization: Bearer $ADMIN_TOKEN"

# 1. Los reportes, abiertos primero.
curl -s -H "$ADMIN" $API/admin/reports | jq
#   { reports: [{ id, reason, note, createdAt, mediaId, challengeId, dayKey, ownerId,
#                 ownerHandle, ownerBanned, photo: 'live'|'deleted'|'gone', evidence,
#                 resolvedAt, action, preservedUntil }] }

# 2. Mirar la foto, descifrada con la llave que entregó quien reportó.
curl -s -H "$ADMIN" $API/admin/reports/<id>/photo -o reporte.jpg
curl -s -H "$ADMIN" "$API/admin/reports/<id>/photo?variant=thumb" -o miniatura.jpg

# 3. Resolver, una sola vez (una segunda responde 409):
#    dismiss  la foto se queda.
#    remove   la foto pasa a lápida y todos los teléfonos la borran.
#    ban      eso, y la cuenta queda vetada (no sube más fotos) con todas sus fotos en lápida.
curl -s -H "$ADMIN" -H 'content-type: application/json' \
  -d '{"action":"remove"}' $API/admin/reports/<id>/resolve

# 4. Abuso sexual infantil, o lo que haya que reportar a NCMEC: ban y preserve.
curl -s -H "$ADMIN" -H 'content-type: application/json' \
  -d '{"action":"ban","preserve":true}' $API/admin/reports/<id>/resolve
```

Sin `preserve`, la evidencia y la llave se borran al resolver, y la foto ya no se puede
volver a ver. Con `preserve: true` se quedan 365 días en `r/<id>/` del bucket: `thumb` y
`full` cifrados, `key` (la llave en base64) y `meta.json` (qué foto, de quién, qué reto,
qué día, el motivo, cuándo y qué se hizo, y cómo abrirla). Eso es lo que se adjunta al
reporte de CyberTipline, y el barrido lo borra solo cuando vence el año. Antes de
publicar en las tiendas hay que registrarse como proveedor en NCMEC (ADR-0051 §19).

Todo lo que dice "descifrada" pasa en el servidor solo en el paso 2, con la llave de esa
foto, y solo mientras el reporte esté abierto o preservado.

## El push es silencioso, y tiene que seguir siéndolo

Todo lo que sale hacia Expo es un mensaje **solo de datos**: sin `title`, sin `body`, sin
`sound`, sin `badge`, sin `channelId`. Lleva `contentAvailable` y `_contentAvailable` en
`true` y `priority: 'normal'` (ADR-0037 §1).

La razón es la regla 11: **el círculo nunca notifica durante una sesión.** Una alerta
visible la dibuja el sistema operativo antes de que la app la vea, así que ningún código
del cliente puede retenerla; un empujón mandado a las 10:40 sonaría a mitad de una sesión
de foco. El ADR-0033 daba por escrito un cliente que retenía esos push; nunca existió, y
su nota al pie ya lo dice.

Entonces el servidor manda **un hecho, no una frase**:

```json
{ "kind": "nudge", "from": "<uuid v7>", "fromHandle": "gus", "at": "1790000000000",
  "challengeId": "<uuid v7>" }
```

`kind` es `nudge`, `invite` o `accepted`. El remitente viaja como id **y** como alias,
nunca con su nombre: el id es lo que el teléfono busca para usar el nombre que ya
sincronizó, el alias es el respaldo para alguien que todavía no conoce (que es justo el
caso de una invitación). Un alias es `[a-z0-9_]{3,20}` y único; un nombre es texto libre
que escribe su dueño, y mandarlo le regalaría a un desconocido que adivine un código de
invitación una línea suya en la barra de notificaciones ajena.

El nombre del reto tampoco sale: quien recibe el empujón está en ese reto y ya lo tiene.
`challengeId` es lo que abre el toque.

**No le devuelvas el título.** Un push que se ve vacío no se arregla agregando texto: se
arregla en el teléfono, que es el único que sabe si hay una sesión corriendo. Si el push
silencioso no despierta la app (Doze en Android, presupuesto agotado en iOS), la fila ya
está en la base y el teléfono la ve en el próximo sync (ADR-0037 §4). Eso es el respaldo,
nunca una alerta.

Lo que falta del lado del cliente para cerrar el ADR-0037: registrar el token de Expo,
recibir en segundo plano (`UIBackgroundModes: remote-notification` en iOS) y componer la
frase con el diccionario del idioma del aparato, pasando por el presupuesto del ADR-0027.

## Verificar un despliegue

```sh
curl -s https://circle-api-production.up.railway.app/health
```

Y el flujo entero (dos cuentas, código, aceptación, semana, reto, marca, empujón, foto,
reporte, bloqueo, moderación) está en los tests; para correrlo contra un servidor de verdad basta con repetir esas llamadas
con `curl` cambiando la URL.
