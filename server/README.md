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

## Correrlo en local

```sh
npm install
npm run dev          # sin DATABASE_URL: todo en memoria, los push se registran y no salen
npm test             # 89 tests: dueño de la fila, cursor, código, identidad, respaldo y topes
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

### Qué pasa en el próximo despliegue

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

## La API, en corto

Todo menos `POST /account` y `GET /health` necesita
`Authorization: Bearer <id>.<secreto>`.

| Verbo | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Responde `{"ok":true}`. Es el healthcheck de Railway. |
| POST | `/account` | Crea la cuenta (el teléfono elige el id, que es un UUID v7; el servidor entrega el secreto **una sola vez**) o actualiza nombre, alias y código de invitación. Sin `inviteCode` en el cuerpo, el código que ya tenía se queda como está; con `null`, lo suelta. Con `{ id }` solo, sin `Authorization`, nace una identidad sin círculo: `201 { id, secret, handle: null }` (ADR-0048). Nombre y alias van juntos o no van (uno solo es `400`), y un código sin ellos también es `400`. Con el secreto, el mismo cuerpo `{ id }` responde `200 { id, handle }` sin escribir nada, y `{ id, name, handle }` reclama el perfil del círculo de una identidad. |
| GET | `/account` | El perfil propio (nombre, alias, código, zona, interruptor de empujones), para un teléfono que acaba de restaurar con la clave de respaldo. Nunca el hash del secreto ni el token de push (ADR-0048). |
| POST | `/account/secret` | Rota el secreto: entrega uno nuevo **una sola vez**, el viejo deja de servir y el token de push se borra, porque apunta al teléfono anterior. Se llama al restaurar (ADR-0048). 10 por hora por cuenta. |
| DELETE | `/account` | Borra la cuenta y todas sus filas, el respaldo incluido. |
| POST | `/device` | Token de push, zona horaria, interruptor de empujones, `platform` (`ios` o `android`) y `appVersion` (1 a 32 caracteres ASCII imprimibles). Todo es opcional y **lo que no viene se queda como estaba**; `pushToken: null` es lo que retira el token. |
| PUT | `/backup` | Sube el respaldo cifrado: bytes crudos (`application/octet-stream`), hasta 5 MB (`413 backup too large`, primero por `Content-Length` y después contando los bytes). Exige `X-Backup-Format` y `X-Backup-Schema` (enteros positivos) y `X-Backup-Platform` (`ios` o `android`); sin ellos, o con el cuerpo vacío, `400`. Reemplaza el anterior y responde `{ updatedAt, size }` (ADR-0048). |
| GET | `/backup` | Los bytes tal como llegaron, con `X-Backup-Format`, `X-Backup-Schema`, `X-Backup-Platform` y `X-Backup-Updated-At`. `404 no backup` si no hay. |
| GET | `/backup/meta` | `{ updatedAt, size, schema, platform, format }` sin los bytes, o `404 no backup`. |
| DELETE | `/backup` | Borra la copia y deja la cuenta: es lo que hace apagar el respaldo en Ajustes. `204` haya o no copia (ADR-0048 §7). |
| POST | `/invite/redeem` | Usa el código de otra persona: queda pendiente de que acepte. |
| POST | `/invite/accept` | Acepta a quien usó tu código; el vínculo queda en los dos sentidos. |
| POST | `/challenge/join` | Entra a un reto de alguien de tu círculo. |
| POST | `/link/end` | Termina el vínculo con `memberId` en los dos sentidos, sea cual sea su estado (Rechazar, Quitar), o con todos si el cuerpo trae `everyone: true` (Salir del círculo). Cada uno sale de los retos que hizo el otro. Responde 200 aunque no hubiera vínculo; un 404 solo puede venir de un servidor sin esta ruta (ADR-0049). |
| POST | `/challenge/leave` | Sale de un reto: el llamante deja de ser participante, nadie lo ve en él ni puede empujarlo en él. Responde 200 aunque ya hubiera salido (ADR-0049). |
| POST | `/sync` | Sube lo que el llamante posee y baja lo que cambió en su círculo desde `since`. Devuelve `now` como próximo cursor y `rejected` con lo que no pasó las reglas. Con `restore: true` agrega `own.marks`: todas las marcas propias en los retos del llamante, sin mirar el cursor (ADR-0048). |

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
- `/invite/redeem`, `/invite/accept` y `/challenge/join` le responden
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
| `POST /account/secret` | 10 por cuenta | Un teléfono nuevo rota una vez, al restaurar. |
| `PUT /backup` | 30 por cuenta | El teléfono sube al cerrar una sesión y como mucho una vez al día; cada subida puede pesar 5 MB. |
| `GET /backup` | 30 por cuenta | Un teléfono nuevo baja una vez, dos si falla el descifrado; son 5 MB por llamada. `GET /backup/meta` no tiene tope propio: no trae bytes. |
| Push de una persona a otra | 5 por par | La fila del empujón siempre se guarda; lo que tiene presupuesto es el push. Sin esto, resincronizar el mismo empujón despierta el teléfono ajeno una y otra vez. |

Un tope que se pasa responde `429` con `Retry-After`.

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

Y el flujo entero (dos cuentas, código, aceptación, semana, reto, marca, empujón) está
en los tests; para correrlo contra un servidor de verdad basta con repetir esas llamadas
con `curl` cambiando la URL.
