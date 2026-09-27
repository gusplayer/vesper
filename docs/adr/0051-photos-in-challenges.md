# ADR-0051 — Fotos en los retos: la grilla es el álbum

**Estado:** aceptada · 2026-09-26. El dueño del producto pidió ejecutarla entera con las
recomendaciones de este documento: opción B con cifrado de extremo a extremo, la tanda 1
primero y 14 días de vida en el servidor. Enmienda la regla 7, la regla 11, la lista "qué
sale" del ADR-0033 y el §1 del ADR-0030 (propuesto), y adelanta el §4 del ADR-0032.

Los tres informes que sostienen este ADR están en `docs/research/photos-in-challenges/`:
`market.md` (30 apps, 72 fuentes), `viability.md` (técnica, costos, tiendas y ley) y
`product.md` (encaje con las reglas, conceptos, wireframes y copy).

## Contexto

El dueño del producto pidió analizar que en los retos y el círculo se pueda subir una
foto, una historia o algo parecido, con tres fines: **compartir la alegría de un logro**,
**dejar evidencia del compromiso** y que se sienta **más de amigos**. Con una condición:
Vesper no se vuelve una red social adictiva y conserva su diseño.

Hoy el círculo no mueve contenido. Sube agregados (horas de la semana, hábitos hechos,
marcas de reto por día), el ánimo es un gesto diario sin contador y el reto se dibuja como
una fila de siete celdas por persona (ADR-0031). El servidor no guarda nada que una
persona haya escrito o fotografiado, salvo el nombre y el alias. Lo personal sale solo en
un respaldo cifrado que el servidor no puede leer (ADR-0048).

**La tensión de fondo, que ningún ADR nombra todavía:** una cámara saca el teléfono justo
en el momento que Vesper protege. Un reto "Sin teléfono en la mesa" con foto como prueba
obliga a sacar el teléfono en la mesa. Todo lo que sigue sale de tomarse eso en serio.

## Qué hace el mercado

| Patrón | Dónde | Qué le pasó o qué enseña |
|---|---|---|
| Foto atada a algo finito, grupo con tope | Locket (widget, 20 amigos), Retro (solo fotos de esa semana), Day One (diarios compartidos de hasta 30 personas, cifrados de extremo a extremo) | Crecen sin feed abierto; Locket es rentable, Retro levantó una Serie A en 2026 |
| Urgencia y reciprocidad forzada | BeReal (aviso sorpresa, "publica para ver"), Lapse (invitar a 5 para publicar), Poparazzi | BeReal pasó de ~15 M a ~6 M de usuarios diarios y terminó vendida y con anuncios; Lapse quitó lo social en 2025; Poparazzi cerró en 2023 |
| Contenido de 24 h | Historias, Estados, Snaps | La caducidad es el motor del FOMO: hay que mirar antes de que se vaya |
| Contador y feed | Strava (kudos), Hevy (likes) | Las actividades con foto reciben más del triple de kudos: la foto se vuelve moneda |
| Prueba con dinero o con IA | Forfeit, stickK, Pact, Jomo, Proofs | Pocos aceptan apostar (11–14 % en ensayos); Pact terminó en un acuerdo con la FTC por cobrar a quien sí cumplía; la IA como juez es el antipatrón |
| Bienestar digital | Opal, Jomo, Clearspace, ScreenZen, one sec, Brick | **Ninguna deja subir fotos.** Lo social es un ranking de tiempo de pantalla o un amigo que vigila |

**La evidencia, dicha con honestidad.** Es fuerte que reportar el progreso a otros ayuda
a cumplir (meta-análisis de 138 estudios, Harkin et al. 2016) y que romper una racha
desmotiva (Silverman y Barasch 2023). Es moderada que hacerlo con amigos ayuda, y que
anunciar una intención puede restar esfuerzo (Gollwitzer et al. 2009): **conviene
compartir hechos, no intenciones.** Es débil que la foto en sí mejore el cumplimiento. Su
valor probable es afectivo —cercanía y celebración—, que es justo lo que pidió el dueño.

**El hueco:** nadie ofrece evidencia de un compromiso entre amigos sin feed, sin dinero y
sin ranking. Lo que separa a una app sana de una adictiva no es el tipo de contenido, sino
**dónde vive y qué lo dispara**. Una foto que cuelga de un hecho y vive en un lugar finito
no engancha; la misma foto en un flujo con contador, sí.

## Opciones

- **A. Diario privado del reto.** La foto es solo tuya, vive en el teléfono y al cerrar el
  reto sale un álbum que puedes compartir afuera. Cumple todas las reglas duras, pero sin
  testigos pierde la mitad de su sentido: no es "más de amigos".
- **B. La grilla es el álbum.** Una foto opcional por persona, por reto y por día, en la
  celda de ese día. La ven solo quienes están en el reto. Al cerrar, la grilla de fotos es
  la celebración. Necesita servidor de objetos, reportar y bloquear, y este ADR.
- **C. Historias, reacciones y comentarios.** Una fila de avatares con anillo arriba del
  círculo, publicaciones de 24 h, emojis y comentarios. Es lo que más engancha: la
  caducidad como FOMO, el anillo de "no visto" como insignia, la reacción como like, el
  orden por novedad como feed. Rompe las reglas 6 y 11 y el presupuesto del ADR-0027. **Se
  descarta, y se escribe aquí para que nadie la proponga como "la fase siguiente".**

Y una decisión dentro de B: que **el servidor pueda ver las fotos** (puede escanearlas y
moderarlas, pero rompe la historia del respaldo que "no puede leer") o que vayan
**cifradas de extremo a extremo** (coherente con el ADR-0048, pero la moderación solo
llega por reporte).

## Decisión propuesta

**B, cifrado de extremo a extremo, entregado en dos tandas: primero A como base local y
después B.**

### Qué es una foto en Vesper

1. **La foto se pega a una marca de un reto, y a nada más.** No hay publicación suelta,
   ni foto al crear un reto (sería anunciar una intención), ni foto al completar una
   sesión (esa ya tiene su arte, ADR-0018), ni fotos en la semana del círculo, ni perfil
   con galería.
2. **Es testimonio, no verificación.** Siempre es opcional: **no existe el "reto con
   prueba"**. Una marca sin foto se ve y cuenta igual. La foto no cambia el `source` de la
   marca (`manual`, `health` o `session`), no suma y no crea una categoría aparte (regla 9,
   ADR-0005, ADR-0042). Nada, ni una IA, la "verifica".
3. **Una por persona, reto y día**, reemplazable, **solo para hoy y ayer**: alcanza para
   el olvido y no para rearmar la semana el domingo por la noche. Un pie opcional de
   80 caracteres, sin menciones, links ni hashtags.
4. **Cámara o galería**, con la cámara primero. Exigir la cámara en el momento empuja a
   sacar el teléfono durante la actividad y no prueba nada. El visor dice de dónde vino
   ("Con la cámara · 18:40" o "De la galería"), igual que una marca dice cómo se contó. La
   grilla no lo dice, y el EXIF nunca se lee para acusar.

### Quién la ve y dónde vive

5. **Solo quienes se unieron al reto, y desde el día en que entraron.** La vista previa
   nombra a quiénes la verán ("La ven Ana y Luis, solo en este reto"), así que alguien que
   entra después no ve lo anterior. Quien fue invitado y no se unió ve la grilla sin
   fotos, con una línea: "En este reto se comparten fotos. Las tuyas son opcionales."
6. **Cada reto decide si lleva fotos**, con un interruptor al crearlo ("Fotos del día").
   Los sugeridos que chocan con una cámara nacen apagados ("Sin teléfono en la mesa",
   "Dormir sin pantalla").
7. **Dónde vive** (sin quinta pestaña, regla 1):
   - `circle/challenge`: las celdas con foto muestran la miniatura, apagada para que la
     página siga siendo de tinta; la foto a color aparece al abrirla. "Marcar hoy" sigue
     siendo el primario (regla 2); "Agregar la foto de hoy" es una fila.
   - `circle/photo-new`: la vista previa, el pie, quiénes la verán y el primario "Agregar
     al reto".
   - `circle/photo`: el visor, con el fade de 160 ms y sin deslizar a la siguiente: se
     vuelve a la grilla, que es la única navegación (regla 6).
   - El cierre del reto: "El álbum", una fila por persona en orden de días (la forma de
     Retro), sin decir cuántas fotos tiene cada quien.
   - Nada en Focus, en Actividad ni en `circle/index`.

### Lo que no hace, a propósito

8. **Ningún aviso por fotos**, aunque la regla 11 permite notificar lo que otra persona
   hizo, y ningún push propio: llegan con la sincronía de siempre. Sin punto de "nuevo" en
   las celdas. El presupuesto del ADR-0027 no cambia.
9. **Sin reacciones por foto, sin comentarios, sin contadores, sin "visto por".** El
   único gesto en el visor es el ánimo diario de siempre, que es a la persona y no a la
   foto. La conversación sigue donde ya está: en WhatsApp.
10. **Sin historias, sin video, sin filtros ni edición.** Un video pesa de 10 a 15 fotos,
    se transcodifica en un servidor que no podría leerlo, y una historia se consume en
    secuencia con barras que avanzan solas.
11. **Nunca desde una sesión.** Ninguna ruta de `session/*`, la Live Activity ni un aviso
    abren la cámara.

### Cuánto dura

12. **En el servidor, hasta 14 días después del cierre del reto; en un reto sin fin, 28
    días por foto.** El círculo se mira una vez por semana (ADR-0021), así que dos semanas
    alcanzan para ver el álbum dos veces sin guardarlo para siempre. Se dice con una fecha
    fija ("Las fotos se quedan aquí hasta el 25 de octubre"), nunca con una cuenta
    regresiva.
13. **En tu teléfono, tus fotos quedan hasta que archivas el reto.** El cierre ofrece
    "Guardar tus fotos" y "Compartir tu álbum": **solo las tuyas**, sin nombres ajenos.
    El álbum del grupo nunca sale de la app. Esto revisa el §1 del ADR-0030, que prohíbe
    sacar un reto porque expondría a otras personas: tu álbum no las expone.
14. **Las fotos no entran en el respaldo cifrado**: el tope es de 5 MB y se sube entero
    cada día. Viajan las filas y las llaves, y al restaurar, las fotos vigentes se bajan
    otra vez. La pantalla lo dice.

### Cómo viaja

15. **En el teléfono:** `expo-image-picker` (cámara y galería; en iOS la galería no pide
    permiso y en Android usa el selector del sistema) y `expo-image-manipulator` (JPEG de
    1280 px a calidad 0,7, unos 200 KB, más una miniatura de 320 px). El recodificado
    quita "casi todo" el EXIF, y casi no basta: una función pura `stripJpegMetadata`
    borra Exif, XMP e IPTC (el GPS va ahí) y tiene su test. La cámara se pide al tocar
    "Tomar una foto" (regla 8); si se niega, `status().reason` lo dice y queda la
    galería. Una capa nueva, `platform/camera`.
16. **Cifrado de extremo a extremo.** Cada identidad deriva una llave X25519 de su
    secreto, con una etiqueta propia como la del respaldo, así que viaja sola por los
    mismos tres caminos (llavero, clave de respaldo y correo). Cada participante tiene
    una llave por reto con época (*sender keys*, como los grupos de WhatsApp), envuelta
    para cada participante como una fila suya, y cada foto tiene su propia llave.
    `expo-crypto` 57 trae AES-GCM pero nada asimétrico, así que se agregan
    `@noble/curves` y `@noble/hashes`: JavaScript puro, auditadas y sin rebuild.
    Restaurar abre las llaves con el secreto viejo antes de rotarlo (ADR-0048 §5).
17. **Almacenamiento:** Railway Buckets, privado, en el mismo proveedor. La subida pasa
    por el servidor, con tope exacto (1,5 MB la foto y 100 KB la miniatura); la bajada va
    directo al bucket con una URL firmada de 5 minutos, que el servidor da solo a
    participantes. El bucket no tiene reglas de vencimiento, así que el servidor barre
    cada hora y concilia cada semana. `/sync` gana filas `media` con lápidas, porque un
    cursor no ve lo borrado (la lección del ADR-0049).

### Moderación: lo que falta antes de la tienda, no antes de probar

18. **Reportar, ocultar y bloquear**, desde un `…` en el visor. Reportar oculta la foto en
    el acto, no revela quién reportó y manda al servidor la llave de esa foto (no la del
    reto): la etiqueta de GCM prueba quién la subió. "Ocultar las fotos de Ana" es solo
    para ti. "Bloquear a Ana" termina el vínculo (ADR-0049) y le impide volver a pedir
    entrar; también aparece junto a "Quitar".
19. **Antes de publicar en las tiendas, y no antes de probar en TestFlight:**
    - Términos que se aceptan en el aviso de la primera foto.
    - Un proceso escrito para actuar sobre un reporte en menos de 24 horas y un correo de
      contacto.
    - Registro como proveedor en NCMEC.
    - La privacidad y las fichas de las tiendas al día (ADR-0046).
    - El cuestionario de edad: contenido de usuarios sí, red social no, mientras no haya
      feed.
    - Una revisión legal de la Ley 1581: la imagen de una persona es dato personal y puede
      salir un menor.

    La guía 1.2 de Apple pide un filtro; con cifrado no puede ser un escaneo del servidor.
    El filtro es de estructura (solo participantes aceptados, ocultar, quitar, bloquear), y
    va con notas para el revisor y un reto de demostración con fotos. **Es el mayor riesgo
    de rechazo.**

## Lo que cambia en las reglas, si se acepta

- **Regla 7:** a lo que sale del teléfono se agregan "las fotos de un reto, cifradas de
  extremo a extremo, que viven hasta 14 días después de su cierre". El bucket es backend
  nuevo y queda autorizado aquí.
- **Regla 11:** "Las fotos de un reto no notifican, no se reaccionan y no se comentan."
- **Qué NO hacer:** "No agregues historias, video, comentarios ni reacciones por foto, y
  nunca pidas una foto para contar una marca."
- **ADR-0033**, lista "qué sale": se enmienda con lo anterior. **ADR-0030 §1** (propuesto):
  "tu álbum de un reto terminado", solo con tus fotos, sale del teléfono si tú quieres.
  **ADR-0032 §4:** reportar y bloquear se adelantan.

## Tandas

| Tanda | Qué | Toca reglas | Días |
|---|---|---|---|
| 1 · Local | La foto opcional en tu marca (picker, manipulador, EXIF quitado y con test, migración 011, `platform/camera`), la grilla con miniaturas, la vista previa, el visor, "Tu álbum" al cierre. Nada sale del teléfono: sin contenido de usuarios ni fichas nuevas, solo el texto del permiso de cámara | Ninguna | 7–10, más 2–3 si "Compartir tu álbum" trae el ADR-0030 |
| 2 · Compartida | Bucket, tablas y rutas, cifrado, cola de subida y lápidas, restaurar, reportar, ocultar y bloquear, el aviso de la primera foto y el interruptor al crear. Se prueba en TestFlight con el círculo del dueño durante un reto de 21 días | 7 y 11 | 20–30 |
| 3 · Tienda | Lo del punto 19 | — | 2–3, más lo legal |

La tanda 1 construye la mayor parte de la interfaz y el camino de la foto sin servidor ni
moderación, y sirve sola. La tanda 2 es lo que el dueño pidió de verdad. Ninguna foto de
otra persona llega a un teléfono de la tienda antes de la 3.

## Cómo se sabrá si funcionó, sin telemetría

- **El Tiempo de uso de Vesper** en los teléfonos del círculo de prueba, antes y durante
  un reto con fotos: si suben las veces que se levanta el teléfono y no las marcas, algo
  se torció.
- **Una entrevista al cierre** con 5 a 10 personas: ¿sacaste el teléfono durante la
  actividad para la foto?, ¿sentiste que tenías que subirla?, ¿abriste el reto solo para
  ver fotos?, ¿hablaron de alguna foto fuera de la app?, ¿qué foto recuerdas?
- **El álbum mismo:** lo sano es esporádico. Todas las celdas llenas en todas las
  personas sugiere obligación sentida.
- **"Repetir"**: si los retos con fotos se repiten más que los retos sin fotos.
- **Reportes:** se espera cero. Uno solo se lee entero.
- Lo que se mide es si el reto se termina, no si se usa la app. Si las fotos suben el uso
  y no el cumplimiento, se quitan.

## Consecuencias

- **Dependencias:**
  - En la app: `expo-image-picker` y `expo-image-manipulator`, nativas y pequeñas, con
    rebuild del dev client; `@noble/curves` y `@noble/hashes`, JavaScript puro, solo en la
    tanda 2. Si se acepta el ADR-0030, además `react-native-view-shot` y `expo-sharing`
    para "Compartir tu álbum".
  - En el servidor: `aws4fetch` para firmar URL.
  - No hacen falta `expo-camera`, `expo-image`, `expo-media-library` ni `expo-video`.
- **Componentes nuevos** en `design/components`: `PhotoTile` (miniatura, espera y
  "agregar"), `PhotoCard` (la foto a lo ancho con su pie) y `PhotoMosaic` (el álbum).
  `HeatGrid` gana imagen por celda y un tamaño grande, y sus medidas pasan a
  `layout.photo` en tokens. Rutas nuevas: `circle/photo-new` y `circle/photo`. Un área
  nueva de strings en los dos idiomas.
- **Datos:** migración 011 en el teléfono. En el servidor, `box_keys`, `sender_keys`,
  `media`, `reports` y `blocks`, todas con borrado en cascada.
- **Costos:** guardar es casi gratis. Con 100.000 usuarios activos son unos 113 GB y
  US$1,70 al mes en Railway Buckets; el caso pesimista son 1,8 TB y unos US$27. Lo caro
  sería moderar en el servidor (unos US$390 al mes con Rekognition a esa escala), y con
  cifrado no se hace.
- **Un precio que se escribe:** quien activa el correo de recuperación (ADR-0050) deja su
  secreto en custodia del servidor, así que con `RECOVERY_KEY` y la base se podrían abrir
  las fotos de sus retos, también las de los demás. La privacidad lo dice.
- **Otro:** una foto enviada puede guardarse con una captura, y la foto de otra persona
  que salió en la tuya es tu responsabilidad. El aviso de la primera foto lo dice.
- **Borrar la cuenta** borra sus fotos en el servidor, pero hoy no avisa a los demás
  (ADR-0049). Hace falta una lápida sin vínculo con `accounts`, o que cada teléfono vence
  las fotos por su cuenta, que ya lo hace.

## Precisiones que la implementación obligó a tomar

**Tanda 1 (local), 2026-09-26.**

- **`expo-image-manipulator` se compila desde el fuente en iOS, con un parche.** iOS decodifica las
  fotos de gama amplia y las HDR (la HEIC en Display P3 del simulador, y casi toda foto de un iPhone
  reciente) en un espacio de color de rango extendido. El paso con que la librería endereza cada
  imagen dibuja en un contexto de 8 bits con ese mismo espacio, y CoreGraphics lo rechaza ("requires
  floating point or CIF10 bitmap context"): la foto fallaba entera como "Image context has been lost".
  `patches/expo-image-manipulator+57.0.20.patch` dibuja esas imágenes en Display P3 de 8 bits (la gama
  se conserva y el JPEG es normal), y `package.json` › `expo.autolinking.ios.buildFromSource` hace que
  el pod se compile desde el fuente, porque el XCFramework precompilado de Expo no llevaría el parche.
  Cuando Expo lo corrija, se quitan las dos cosas.
- **El selector de iOS pide la representación compatible** (un JPEG que transcodifica el sistema), no
  el archivo original de la fototeca.
- **En Android 8 y 9 no hay cámara.** Por debajo de Android 10, abrir la cámara exige también
  `WRITE_EXTERNAL_STORAGE`, y ese permiso está bloqueado a propósito (Vesper solo escribe en sus
  carpetas). `cameraStatus()` lo dice con su razón y queda la galería.
- **Una foto sin marca se guarda y no se dibuja.** Desmarcar el día la oculta; volver a marcarlo la
  trae de vuelta. Archivar el reto, salir del círculo, quitar a alguien y "Borrar todo y reiniciar"
  borran filas y archivos.
- **Las fotos no entran al respaldo** (`challenge_photos` se excluye al exportar y se ignora al importar).
- **La celda de hoy no cambia** cuando falta la foto: ofrecerla le toca solo a la fila, para que una
  marca sin foto se vea igual que siempre.

**Tanda 2 (compartida), 2026-09-26.**

- **Una llave por foto, envuelta para cada participante (ECIES), en vez de *sender keys* con
  época.** Cada foto lleva su llave AES-256 y un par X25519 efímero con el que se envuelve esa
  llave para cada participante con llave publicada (HKDF-SHA256 y AES-GCM). Doce envolturas
  ocupan menos de un kilobyte y no hay épocas que mantener: quien entra después no tiene
  envoltura de lo anterior, y quien sale deja de recibir envolturas nuevas.
- **El servidor no distingue invitado de unido**, porque `participantIds` incluye a quien el
  creador agregó. El servidor exige envoltura para cada participante con llave, así que la
  recibe también quien todavía no se unió. Su teléfono no le muestra ninguna foto hasta que se
  une, y entonces ve el álbum del reto. Esto precisa el punto 5: se ve desde que el creador te
  agrega, no desde que te unes.
- **La vista previa nombra a quien está en tu círculo.** Un participante del reto que no es de
  tu círculo recibe envoltura, pero su nombre no está en tu teléfono.
- **Tus fotos quedan tuyas.** Una lápida del servidor (vencimiento, moderación, tu propio
  borrado) borra fila y archivos de una foto ajena. Una tuya que tiene sus archivos vuelve a ser
  solo local y queda hasta que archivas el reto.
- **El vencimiento lo decide el servidor** en la zona horaria que el teléfono mandó por
  `/device`, y el teléfono guarda ese.
- **Restaurar abre las fotos con la llave vieja.** Antes de rotar el secreto, la restauración
  sincroniza con las credenciales viejas y abre cada envoltura; la llave de cada foto queda en
  su fila, y esas filas viajan en el respaldo sin sus archivos. Rotar borra la llave pública en
  el servidor y el primer sync publica la nueva. Lo que otros suban en esos segundos no trae
  envoltura para la llave nueva y ese teléfono no lo verá.
- **Moderar es sacar.** Un reporte copia la foto cifrada y su llave a la evidencia en el
  momento, y el servidor comprueba la llave abriendo la miniatura. "Remove" pone lápida a la
  foto. "Ban" veta la cuenta, pone lápida a todas sus fotos, termina todos sus vínculos como
  "Salir del círculo" y le impide canjear o aceptar códigos. `preserve` conserva la evidencia
  365 días.
- **Un bloqueo dentro del reto de un tercero** deja a los dos en el reto, pero ninguno envuelve
  para el otro, sus fotos no bajan y los empujones entre ellos se rechazan.
- **Sin bucket, las fotos viven en memoria** y el servidor lo dice al arrancar. En producción
  no se encienden sin un Railway Bucket (`AWS_*` del preset "AWS SDK", ver `server/README.md`).

**Fase 4 (tu álbum hacia afuera), 2026-09-26.**

- **"Compartir tu álbum"** captura una tarjeta 9:16 en tinta (`AlbumCard`) con tus fotos en su
  día, el nombre del reto, cuánto duró y la marca de Vesper, sin URL, sin QR y sin nadie más.
  Usa la maquinaria que proponía el ADR-0030: `react-native-view-shot` fijada a 5.1.1 y
  `expo-sharing`. La captura se monta con opacidad 0 bajo la hoja (su plan B), y la grilla 4×4
  pasó a un componente `Mark` que comparten `HeroObject` y `BootReveal`.
- **"Guardar o compartir"** en el visor de tu propia foto entrega el JPEG a la hoja del sistema;
  guardar en Fotos pasa por ahí. En la foto de otra persona no existe.
- **iOS pide `NSPhotoLibraryAddUsageDescription`** para "Guardar imagen" desde la hoja, o la app
  se cierra: está en `app.json` y en `locales/`. El ADR-0030 decía que `app.json` no cambiaba.

**Prueba en Android, 2026-09-27.**

- **Un reto cuyo creador sale de tu círculo se termina hoy si tienes fotos tuyas en él**, en
  vez de archivarse (ADR-0049 lo archivaba). Archivar borra sus fotos, y las tuyas quedan
  hasta que *tú* archivas el reto (§13): así el cierre muestra cómo fue y tu álbum, y el
  archivo es tuyo. Sin fotos tuyas se archiva como antes. Lo encontró la prueba: al bloquear
  al creador, la foto propia se borraba sin aviso.
- **El fundido de una miniatura corre en JS, no en el hilo nativo.** En Android, un fundido
  nativo que arranca sobre una pantalla que está debajo de otra ruta (el reto, mientras la
  vista previa guarda) nunca terminaba, y la miniatura de la fila se quedaba gris hasta
  volver a montar la pantalla.

**Al llevarlo a `main`, 2026-09-27.**

- **Sin bucket, en producción las fotos se apagan.** Con una base real y sin las variables
  del bucket, `POST /media`, los `PUT` y la URL de descarga responden `503 photos not
  configured`, como el correo de recuperación sin su llave. Guardarlas en memoria las habría
  perdido en el primer reinicio bajo filas que dicen que están. El teléfono deja la foto en
  su cola, y sale sola el día que exista el bucket.

## Alternativas descartadas

- **Historias de 24 h, reacciones y comentarios** (opción C): feed, FOMO y likes con
  otro nombre.
- **La foto como condición de la marca**, o un "reto con prueba": saca el teléfono en el
  peor momento, la galería lo vuelve trampa, convierte a los amigos en jueces y choca con
  lo que Salud marca solo.
- **Solo la cámara en el momento**, como BeReal: más creíble, pero empuja a usar el
  teléfono durante la actividad, y la marca sigue siendo declarada.
- **Que el servidor vea las fotos:** permite escanearlas, pero pone en claro lo más
  sensible que la app tendría (caras, casas, cuerpos en el gimnasio) al lado de un
  respaldo que el servidor no puede leer. Obliga a declarar "Fotos" en las fichas y cuesta
  moderarlo.
- **Dinero o IA como árbitro:** poca gente lo acepta, invierte el incentivo (Pact) y no
  es de amigos.
- **Un resumen diario de fotos como aviso:** gasta el presupuesto del ADR-0027 en algo que
  se puede ver al abrir.
- **Guardar las fotos en Postgres** (`bytea`): infla la base y cuesta treinta veces más
  que un bucket.

## Lo que el dueño decidió

1. Opción B, con cifrado de extremo a extremo.
2. La tanda 1 (local) primero, y después la 2 y la 3, cada una en su commit, en la rama
   `feat/challenge-photos`.
3. 14 días de vida en el servidor después del cierre; 28 por foto en un reto sin fin.
