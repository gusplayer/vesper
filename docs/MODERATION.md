# Moderación de las fotos de un reto

> **Esto no es asesoría legal.** Lo escribió quien conoce el código, para que exista un
> proceso antes de publicar (ADR-0051 §19). Las obligaciones que nombra (18 U.S.C. §2258A,
> Ley 679 de 2001, Ley 1581 de 2012) las tiene que confirmar un abogado para el caso de
> Vesper: un responsable en Colombia, con el servidor en EE. UU. Lo que más lo necesita va
> marcado con **[REVISAR]**.

Escrito el 2026-09-26 contra la guía de la tanda 2 del ADR-0051. Las rutas `/admin/*` las
escribe `server/` en esa tanda: si el código responde distinto de lo que dice aquí, manda el
código y este documento se corrige en el mismo commit. Los Términos (`web/terms.html`,
"Reportar, ocultar y bloquear") prometen lo que este documento cumple.

## Qué puede ver quien modera, y qué no

Las fotos viajan cifradas de extremo a extremo. El servidor no puede abrir ninguna, y quien
modera tampoco, **salvo una foto reportada**: el teléfono que reporta manda la llave de esa
foto (no la del reto ni la de otras fotos), el servidor comprueba que abre la miniatura y la
guarda con el reporte. Con eso `GET /admin/reports/:id/photo` descifra la foto completa.

| Se ve | No se ve |
|---|---|
| El reporte: id, motivo, nota (hasta 200 caracteres), cuándo llegó, quién lo hizo | Ninguna foto que nadie haya reportado |
| La foto reportada, completa, y su pie (la misma llave lo abre) | Las demás fotos de esa persona o de ese reto |
| Los datos en claro de la foto: quién la subió, reto, día, medidas, peso, origen, fechas | La IP de nadie: el servidor no la guarda |
| La cuenta que la subió: id, alias y nombre del círculo | Nada que diga quién es esa persona fuera de Vesper |

No hay escaneo automático y no puede haberlo: el filtro es estructural (solo participantes
aceptados, ocultar, bloquear) y la moderación llega por reporte. Quien reporta nunca queda
expuesto: a quien subió la foto no se le dice quién fue.

Los motivos que ofrece la app, con su valor en la API:

| En la app (es / en) | `reason` |
|---|---|
| «No debería estar aquí» / "It should not be here" | `unwanted` |
| «Sale alguien sin su permiso» / "Someone is in it without consent" | `consent` |
| «Sale un menor» / "It shows a minor" | `minor` |
| «Otra cosa» / "Something else" | `other` |

## El compromiso: 24 horas

Todo reporte se resuelve **en menos de 24 horas desde que llega** (`createdAt` del reporte).
Es lo que dicen los Términos, lo que pide la guía 1.2 de Apple ("timely responses") y lo que
Apple escribe cuando rechaza una app por UGC: *"The developer must act on objectionable
content reports within 24 hours by removing the content and ejecting the user who provided
the offending content"* ([ejemplo](https://github.com/QuickBlox/q-municate-ios/issues/320)).

**El servidor no avisa cuando llega un reporte** (no hay push ni correo para esto). Así que
se mira a horas fijas, **dos veces al día**, por ejemplo a las 9:00 y a las 21:00 de Bogotá:
ningún reporte espera más de unas 12 horas a que alguien lo vea. Un recordatorio en el
calendario basta. Si el dueño va a estar más de 12 horas sin poder mirar, tiene que dejar a
alguien más con acceso **[REVISAR: hoy hay un solo `ADMIN_TOKEN`]**.

## Preparar la terminal

Cada vez que se modera, desde la carpeta enlazada al servicio `circle-api` de Railway:

```sh
cd ~/Dev/vesper/server   # railway status → Project: vesper · Environment: production · Service: circle-api
export VESPER_API=https://circle-api-production.up.railway.app
export ADMIN_TOKEN="$(railway variable list --json | jq -r '.ADMIN_TOKEN // empty')"
[ -n "$ADMIN_TOKEN" ] && echo "token cargado" || echo "falta ADMIN_TOKEN en Railway"

# Llama a una ruta /admin. El token va en un archivo efímero (-H @<(...)): no aparece en la
# línea de comandos, ni en `ps`, ni en el historial.
vadmin() {
  local method="$1" route="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -fsS -X "$method" "$VESPER_API$route" \
      -H @<(printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN") \
      -H 'Content-Type: application/json' --data "$body"
  else
    curl -fsS -X "$method" "$VESPER_API$route" \
      -H @<(printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN")
  fi
}
```

Funciona en zsh y en bash (probado contra un servidor de eco local). Reglas del token:

- **Nunca se imprime.** Nada de `echo $ADMIN_TOKEN`, `set -x`, `env`, ni pegarlo en un chat,
  un issue, un commit o una conversación con un agente.
- Vive solo en las variables de Railway. La terminal lo lee de ahí y lo olvida al final:
  `unset ADMIN_TOKEN`.
- Sin `ADMIN_TOKEN` en el servidor, las rutas `/admin/*` responden `404`.

## Un reporte, paso a paso

1. **Ver los abiertos.** Salen primero los que no se han resuelto.

   ```sh
   vadmin GET /admin/reports | jq .
   ```

   Si la lista está vacía, se termina aquí. Si no, para cada reporte abierto:

2. **Abrir su entrada en el registro** (más abajo) con lo que dice la lista: id, cuándo
   llegó, motivo, nota, la foto y quién la subió.

3. **Mirar la foto**, en una carpeta temporal privada y nunca en el Escritorio, Documentos
   o Descargas (se sincronizan con iCloud):

   ```sh
   ID=<id del reporte>
   CASE="$(mktemp -d)"
   vadmin GET "/admin/reports/$ID/photo" > "$CASE/foto.jpg" && open "$CASE/foto.jpg"
   ```

   No se reenvía, no se captura, no se le pasa a nadie ni a ningún servicio o agente. Si el
   motivo es «Sale un menor», primero lee el protocolo de abajo.

4. **Decidir**, con la tabla de la sección siguiente. Ante la duda, se quita: una foto vive
   semanas, y dejar algo dañino hace más daño que quitar algo inocente.

5. **Resolver.** Una de estas, según la decisión:

   ```sh
   vadmin POST "/admin/reports/$ID/resolve" '{"action":"dismiss"}'                 # no rompe los términos: se queda
   vadmin POST "/admin/reports/$ID/resolve" '{"action":"remove"}'                  # se quita la foto, para todos
   vadmin POST "/admin/reports/$ID/resolve" '{"action":"ban"}'                     # se quita, y la cuenta pierde todas sus fotos y no sube más
   vadmin POST "/admin/reports/$ID/resolve" '{"action":"ban","preserve":true}'     # lo anterior, y se conserva por 365 días (solo abuso de un menor)
   ```

   `dismiss` deja la foto para los demás; para quien la reportó sigue oculta. `remove` le
   pone lápida y borra sus objetos: sale de todos los teléfonos en su siguiente
   sincronía. `ban` hace lo mismo con **todas** las fotos de esa cuenta y le impide subir
   más (`403`). `preserve` copia la foto cifrada y su llave a `r/<id>/` del bucket durante
   365 días.

6. **Comprobar** que el reporte ya no está abierto (`vadmin GET /admin/reports | jq .`).

7. **Borrar la copia local y cerrar la entrada del registro.**

   ```sh
   rm -rf "$CASE"; unset CASE ID
   ```

8. **Si el reporte llegó por correo**, contestar (abajo, "Pedidos por correo").

## Qué hacer según el motivo

La regla de fondo es la de los Términos: **tolerancia cero**, sin advertencia previa. Lo
sexual, lo violento, el odio, el acoso, lo ilegal y lo que exponga a un menor se resuelven con
`ban`, porque Apple espera que se retire el contenido **y** a quien lo subió. Lo demás que
rompe los Términos (alguien sin su permiso, publicidad) se quita con `remove`, y pasa a `ban`
si la cuenta insiste: es lo que dicen los Términos en "Qué hacemos con un reporte".

| Motivo | Qué mirar | Decisión |
|---|---|---|
| **No debería estar aquí** (`unwanted`) | ¿Está en la lista de los Términos (sexual, violento, odio, acoso, ilegal, datos o pantallas de otros)? | Si está: `ban`. Si solo es aburrida, fuera de tema o no le gustó a alguien: `dismiss` (quien reportó ya no la ve) |
| **Sale alguien sin su permiso** (`consent`) | ¿Hay una persona reconocible que no es quien subió la foto? No hay forma de saber si dio permiso | Por defecto `remove`. Si es íntima, humillante, muestra su casa o sus documentos, o la cuenta ya tuvo otro reporte así: `ban` |
| **Sale un menor** (`minor`) | Tres casos distintos; mira el protocolo de abajo antes de abrirla | Abuso o explotación sexual: protocolo completo (`ban` con `preserve`). Un menor en peligro, maltratado o humillado sin contenido sexual: `ban` y reporte a las autoridades de Colombia **[REVISAR: si se conserva]**. Un niño reconocible en una foto común (un cumpleaños): `remove` **[REVISAR]** |
| **Otra cosa** (`other`) | La nota. Publicidad, spam, algo que no tiene que ver con el reto | Aplica la misma lista. Publicidad o spam: `remove`, y `ban` si se repite |

Si una nota o una foto sugiere que **alguien está en peligro ahora**, eso va primero: 123
(emergencias en Colombia) o la línea 141 del ICBF si es un menor.

Hoy `ban` no saca a la cuenta del círculo de nadie ni la cierra: solo le quita las fotos.
Los Términos dicen que una falta grave o repetida **cierra la cuenta**, y el aviso de la
primera foto dice que quien sube algo así "sale de Vesper". Mientras el servidor no tenga una
ruta para eso, cerrar una cuenta es un paso a mano en la base **[REVISAR: pendiente del
servidor, abajo]**.

## Protocolo: abuso o explotación sexual de un menor

Es el único caso en el que **se conserva** lo reportado y se reporta afuera. En orden, el
mismo día:

1. **Mirar lo mínimo.** Abrir la foto una vez, solo para confirmar, en la carpeta temporal
   del paso 3. No guardarla en otro lado, no reenviarla, no capturarla, no mostrarla.
   **[REVISAR: con un abogado, qué implica tener esa copia en el computador mientras se hace
   el reporte.]**
2. **Resolver con `ban` y `preserve`:**

   ```sh
   vadmin POST "/admin/reports/$ID/resolve" '{"action":"ban","preserve":true}'
   ```

   La foto sale de todos los teléfonos, la cuenta pierde todas sus fotos y no sube más, y
   una copia cifrada con su llave queda en `r/<id>/` del bucket por 365 días. **No se borra
   la cuenta**: sus datos pueden hacer falta para una autoridad.
3. **Reportar al [CyberTipline de NCMEC](https://report.cybertip.org/)**, como proveedor
   registrado (ver "Una sola vez"). El reporte lleva la imagen (se sube desde la carpeta
   temporal), la fecha y hora en que se subió la foto (UTC), el id, el alias y el nombre de
   la cuenta que la subió, el id del reto y el del reporte, y que llegó por el reporte de
   un usuario sobre contenido cifrado de extremo a extremo. 18 U.S.C. §2258A pide reportar
   *"as soon as reasonably possible after obtaining actual knowledge"* y conservar lo
   reportado *"for 1 year after the submission to the CyberTipline"*
   ([texto](https://www.law.cornell.edu/uscode/text/18/2258A)). Como el servidor cuenta los
   365 días desde que se resuelve, **el reporte a NCMEC sale el mismo día**. Se anota su
   número en el registro.
4. **Reportar en Colombia.** La Ley 679 de 2001 prohíbe *"alojar en su propio sitio
   imágenes […] que impliquen directa o indirectamente actividades sexuales con menores de
   edad"* (art. 7) y obliga a los proveedores a *"denunciar ante las autoridades competentes
   cualquier acto criminal contra menores de edad de que tengan conocimiento"* (art. 8)
   ([texto](https://www.oas.org/juridico/spanish/cyb_col_ley_679_2001.pdf)). Canales:
   - Policía Nacional: [denuncia por material de explotación sexual infantil](https://www.policia.gov.co/denuncia-por-material-con-contenido-explotacion-sexual-infantil),
     [¡ADenunciar!](https://adenunciar.policia.gov.co/Adenunciar/) y el
     [CAI Virtual](https://caivirtual.policia.gov.co/).
   - [Te Protejo](https://teprotejocolombia.org/), la línea de reporte de Red PaPaz.

   **[REVISAR: cuál de estos canales es el que corresponde a un proveedor, y si hace falta
   además la Fiscalía.]** Se anota el número o la constancia en el registro.
5. **Borrar la copia local** (`rm -rf "$CASE"`) en cuanto NCMEC la recibió.
6. **No avisarle** a la cuenta (tampoco hay cómo) y no hablar del caso fuera de los canales
   de arriba.
7. Si una autoridad pide conservarlo **más de un año**, hoy no hay ruta para extenderlo
   **[REVISAR: pendiente del servidor]**.

Ver algo así es duro. Está bien parar un momento y pedir apoyo después.

Lo que queda conservado en `r/` es, junto con su llave, **material legible**: la ley pide
guardarlo *"in a secure location"* y limitar el acceso (y, según el mismo artículo, seguir el
marco de ciberseguridad del NIST). Nadie abre `r/` desde el explorador de archivos del bucket
salvo para responder a una autoridad, y el proyecto de Railway tiene los miembros mínimos
**[REVISAR]**.

## Pedidos por correo

El correo publicado en los Términos y en la Privacidad es
[gusmoreno.dev@gmail.com](mailto:gusmoreno.dev@gmail.com), mientras no exista uno de
seguridad infantil.

- **Un reporte que llega por correo.** Sin la llave, el servidor no puede abrir la foto, y
  hoy `/admin` solo actúa sobre reportes hechos desde la app. Si quien escribe está en el
  reto, se le pide que la reporte desde el «…» de la foto. Si no está —por ejemplo, la
  persona que aparece en ella—, se le pide el reto, el día y el alias de quien la subió, y
  hoy la única salida es pedirle a alguien del reto que la reporte **[REVISAR: pendiente del
  servidor, quitar una foto por id]**. Se contesta en menos de 24 horas aunque la respuesta
  sea "estamos en eso".
- **Derechos de la Ley 1581** (conocer, actualizar, rectificar, revocar, suprimir): una
  consulta se contesta en máximo 10 días hábiles y un reclamo en 15 (arts. 14 y 15). Lo que
  el servidor tiene de una cuenta en claro está en la base de Neon; las fotos no se pueden
  entregar porque el servidor no las puede abrir **[REVISAR: hoy se consulta a mano]**.
- **Borrar una cuenta sin la app** (lo exige Play): hoy `DELETE /account` necesita el
  secreto de la cuenta. A mano: la fila de `accounts` (todo lo demás cae en cascada) y los
  objetos del prefijo `m/<id>/` del bucket **[REVISAR: pendiente del servidor]**.

## El registro de lo actuado

Cada reporte deja una entrada, **fuera del repositorio** y en un lugar privado (una nota
cifrada o una hoja privada con verificación en dos pasos). Nunca se commitea: tiene datos
personales. Nunca lleva la imagen.

```text
Reporte:    <id>
Llegó:      2026-10-03 14:22 (Bogotá) · createdAt del servidor
Visto:      2026-10-03 21:05 · por: <quién>
Motivo:     consent · nota: <resumen, sin copiar datos de terceros>
Foto:       <mediaId> · reto <challengeId> · día <dayKey> · subió <accountId> (@alias)
Decisión:   remove · preserve: no · por qué: <una línea>
NCMEC:      — (o el número del CyberTipline)
Colombia:   — (o el canal y el número)
Respuesta:  — (o a quién y cuándo, si llegó por correo)
Cerrado:    2026-10-03 21:12
```

Cuánto se guarda el registro es una decisión legal **[REVISAR]**; como mínimo, lo que dure
lo conservado.

## Una sola vez, antes de publicar (el dueño)

1. **Registrarse como proveedor en el CyberTipline de NCMEC**:
   [esp.ncmec.org/registration](https://esp.ncmec.org/registration). El registro es lo que
   permite mandar la imagen con el reporte. NCMEC acepta proveedores de fuera de EE. UU.:
   *"23% of these are non-U.S.-based companies that have voluntarily registered to report to
   the CyberTipline"* ([datos de NCMEC](https://www.missingkids.org/cybertiplinedata)).
   **[REVISAR: si §2258A obliga a Vesper, o si es voluntario.]**
2. **Definir `ADMIN_TOKEN` en Railway**, sin que el valor pase por la pantalla ni por el
   historial:

   ```sh
   cd ~/Dev/vesper/server
   openssl rand -base64 32 | tr -d '\n' | railway variable set ADMIN_TOKEN --stdin
   ```

   Redespliega el servicio. Se comprueba con `vadmin GET /admin/reports`: una lista vacía,
   no un `404`. Para rotarlo, el mismo comando; hay que rotarlo si alguna vez se imprimió.
3. **Crear el bucket de Railway** en el proyecto `vesper`, entorno `production`: *Create ›
   Bucket*. La región no se puede cambiar después: la misma del servicio **[REVISAR]**.
   Después, en *circle-api › Variables*, referenciar las variables que da el bucket
   (`BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `REGION`, `ENDPOINT`,
   [docs](https://docs.railway.com/storage-buckets)) con los nombres que lee el servidor
   (`server/README.md`, tanda 2) **[REVISAR: los nombres exactos]**. Al arrancar, el servidor
   dice en una línea si guarda en el bucket o en memoria. Lo que conviene saber del bucket:
   es privado, cifrado en reposo, sin reglas de vencimiento (el servidor barre cada hora),
   sin versiones, y si se borra se puede restaurar durante 52 horas y después se pierde
   entero.
4. **Publicar un correo de seguridad infantil**, propio y leído con la misma frecuencia, y
   ponerlo en los Términos (donde hoy hay un `[REVISAR]`), en la Privacidad, en Play Console
   si lo pide y como contacto de soporte en App Store Connect.
5. **Poner el recordatorio de las dos revisiones diarias** (9:00 y 21:00).
6. **Verificación en dos pasos** en Railway, Neon, GitHub y el correo, y los miembros mínimos
   en el proyecto de Railway: quien entra ahí puede leer `r/`.
7. **Pasar los `[REVISAR]` por un abogado**, con la lista de `docs/APP_REVIEW.md` §5.
8. **Registro Nacional de Bases de Datos de la SIC:** según el Decreto 090 de 2018 solo
   obliga a sociedades y entidades sin ánimo de lucro con activos de más de 100.000 UVT, así
   que probablemente no aplica a una persona natural **[REVISAR]**.

## Lo que este proceso le pide al servidor

Pendientes para una tanda siguiente; ninguno bloquea TestFlight:

- **Un aviso al dueño cuando llega un reporte** (un correo por Resend, sin contenido): con
  él, las 24 horas dejan de depender de un recordatorio.
- **Cerrar una cuenta desde `/admin`**: `ban` hoy solo quita las fotos, y los Términos y el
  aviso de la primera foto prometen más.
- **Quitar una foto por id desde `/admin`**, para el pedido por correo de quien aparece en
  ella.
- **Borrar una cuenta por id desde `/admin`**, para el borrado sin la app que pide Play.
- **Guardar con lo conservado sus datos en claro** (dueño, alias, fechas) y poder extender
  los 365 días si una autoridad lo pide.
- **Olvidar la llave de un reporte descartado**, para que una foto que no rompía nada no
  quede legible más de lo necesario.
