# Fotos en los retos y en el círculo: viabilidad técnica, de costos y de cumplimiento

2026-09-26 · Evaluación, no decisión. Leído contra `CLAUDE.md`, ADR-0021, 0027, 0030, 0032, 0033, 0037,
0044, 0046, 0048, 0049, 0050, `server/` (`schema.sql`, `app.ts`, `store.ts`) y `src/platform/backupCrypto.ts`.
Las APIs de Expo se verificaron en la documentación de SDK 57, no de memoria.

## 0. Recomendaciones en una tabla

| Tema | Recomendación |
|---|---|
| Captura | `expo-image-picker` (cámara y galería del sistema), sin `expo-camera` |
| Proceso | `expo-image-manipulator` → JPEG de 1280 px, calidad 0,7 (~200 KB), y miniatura de 320 px. EXIF quitado **en JS y con test** |
| Almacenamiento | **Railway Buckets** (Tigris, S3, salida gratis). Alternativa: R2. Nunca `bytea` |
| Cifrado | **B, de extremo a extremo**, con *sender keys* por reto y una llave por foto: 6 a 9 días más que A |
| Moderación | Reportar, ocultar y bloquear. El reporte revela la llave de esa foto, y se actúa en menos de 24 h |
| Hipótesis del dueño | Sí: una foto opcional por persona, reto y día, solo para participantes, hasta el cierre + 7 días. Nunca verifica una marca |
| Respaldo y avisos | Las fotos no van al blob de 5 MB. Ningún aviso por foto |
| Video e historias | No por ahora |
| Orden | Fase 0 local (7 a 10 días) → fase 1 con cifrado (20 a 30) → fase 2 opcional, cada una con su ADR |

## 1. El camino de la foto en el teléfono (Expo SDK 57)

**Captura.** [`expo-image-picker`](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/) abre la cámara
y la galería del sistema. Según su documentación de SDK 57, *"No permissions request is necessary for
launching the image library on iOS"*, y en Android usa el selector del sistema (`legacy: false`), que es lo
que pide la [política de fotos de Play](https://support.google.com/googleplay/android-developer/answer/15800983?hl=en).
La cámara **siempre** pide permiso. El plugin agrega `READ_EXTERNAL_STORAGE` y `WRITE_EXTERNAL_STORAGE`: se
bloquean con `android.blockedPermissions`, comprobando el selector en API 26 a 29.

- **Cámara y galería**, con la cámara primero. La foto del gimnasio suele tomarse antes de abrir Vesper.
  Obligar a usar la cámara no prueba nada, y una foto **nunca vuelve verificada una marca** (regla 9,
  ADR-0005, ADR-0042): la marca sigue siendo `manual`.
- **Sin `expo-camera`**: exige un visor y controles propios (reglas 3 y 6) y solo sirve para algo tipo BeReal.
- **Regla 8**: la cámara se pide al tocar “Tomar foto”; si se niega, `status().reason` lo dice y queda la galería.

**Proceso.** [`expo-image-manipulator`](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/):
`manipulate(uri).resize()` → `renderAsync()` → `saveAsync({ format: SaveFormat.JPEG, compress: 0.7 })`.
JPEG antes que WebP: se abre en todas partes, sirve para el collage y la hoja de compartir, y lo que
ahorraría WebP vale centavos (§2). HEIC entra y sale como JPEG.

**EXIF y GPS.** En iOS, la cámara no pone GPS (*"the EXIF data does not include GPS tags in the camera
case"*), pero la galería sí puede traerlo. Recodificar quita *"most exif data"*
([issue #28913](https://github.com/expo/expo/issues/28913)), y “casi” no basta. Propongo una función pura,
`stripJpegMetadata(bytes)`, que recorra los marcadores JPEG, borre APP1 (Exif/XMP) y APP13 (IPTC) y
conserve APP0 y APP2 (ICC). Son unas 60 líneas con su test en vitest sobre una muestra con GPS. La
orientación se comprueba con fotos en vertical en los dos sistemas.

**Archivos y visualización.** `expo-file-system` 57 ya viene como dependencia de `expo` y trae `File`,
`Paths`, `bytes()`, `write()` y `File.upload` ([docs](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/)).
Las fotos propias van a `Paths.document` y las ajenas, descifradas, a `Paths.cache`. El `Image` de React
Native las muestra desde `file://`. [`expo-image`](https://docs.expo.dev/versions/v57.0.0/sdk/image/) solo se
justifica en la opción A, donde la URL firmada cambia en cada petición y la caché necesita `cacheKey`. El
visor es una ruta a pantalla completa con fundido de 160 ms y sin zoom con rebote (regla 6).

| Dependencia | ¿Imprescindible? | Peso y rebuild |
|---|---|---|
| `expo-image-picker` | Sí | Módulo nativo, poco peso; en Android trae el recortador (no se usa `allowsEditing`). Plugin con `cameraPermission` y `photosPermission`. Rebuild. |
| `expo-image-manipulator` | Sí | Nativo y pequeño. Rebuild. |
| `expo-file-system` | Ya está (transitiva) | Se declara con `npx expo install`, sin costo nuevo. |
| `@noble/curves` (+ `@noble/hashes`) | Solo en la opción B | JS puro, decenas de KB minificados, sin rebuild. [Auditado](https://github.com/paulmillr/noble-curves) por Trail of Bits (2023 y 2026) y Cure53 (2024). |
| `react-native-view-shot` + `expo-sharing` | Para el collage que sale del teléfono | Ya propuestas en ADR-0030 (5.1.1 fijada por bridgeless). Rebuild. |
| `expo-image`, `expo-camera`, `expo-media-library`, `expo-video` | No | “Guardar en Fotos” sale en la hoja del sistema de `expo-sharing`, sin pedir permiso de escritura. |

Se agregan dos o tres módulos nativos, así que hay que reconstruir el dev client en iOS y en Android y
correr `pod install`. No hay librerías de UI.

## 2. Almacenamiento y entrega

| Opción | Almacenamiento | Salida | Operaciones | Encaje |
|---|---|---|---|---|
| Postgres `bytea` (Neon) | [US$0,35/GB-mes](https://neon.com/docs/introduction/plans) | Por el servicio: [US$0,05/GB](https://railway.com/pricing) | — | **No.** Infla la base, el WAL y las ramas, y cada foto pasa por la memoria del servicio. |
| **Railway Buckets** | [US$0,015/GB-mes](https://docs.railway.com/storage-buckets/billing) | **Gratis** | Gratis | **Recomendado.** Ya existe: Tigris, compatible con S3, [solo privado y con URL firmadas](https://docs.railway.com/storage-buckets), en el mismo proveedor. Sin reglas de ciclo de vida: borra el servidor. |
| Cloudflare R2 | [US$0,015/GB-mes, 10 GB gratis](https://developers.cloudflare.com/r2/pricing) | Gratis | A US$4,50/M, B US$0,36/M, con cuota gratis | Alternativa, con ciclo de vida. Un proveedor más. |
| Neon Object Storage | [US$0,023/GB-mes](https://neon.com/object-storage) | Dentro de los 500 GB incluidos | Gratis | Posible, más caro. |
| Backblaze B2 | [US$6,95/TB-mes](https://www.backblaze.com/cloud-storage/pricing) | Gratis hasta 3 veces lo guardado | Con costo | Barato; otro proveedor. |
| AWS S3 | US$0,023/GB-mes | US$0,09/GB | PUT US$0,005/1000 | La salida es lo caro. |

**Entrega.** La subida pasa **por el servidor** (`PUT /media/:id`, con el `readCapped` de `/backup`): la
credencial del bucket nunca sale y el tope no depende de firmar `Content-Length`. La bajada va **directo
al bucket**, con una URL firmada de 5 minutos que el servidor da en JSON **si el llamante participa en el
reto**. Un 302 no sirve: `fetch` puede reenviar `Authorization` y S3 rechaza dos firmas. Topes: 1,5 MB la
foto y 100 KB la miniatura.

**Costos al mes.** Supuestos: el 30 % de los usuarios está en un reto con otros; 3 fotos por semana cada
uno; 0,25 MB por foto con su miniatura; 35 días de vida en promedio; 0,6 MB de bajadas por foto.

| Usuarios activos | Fotos/mes | GB guardados | GB bajados | Railway Bucket | R2 | S3 | Neon `bytea` + salida por Railway |
|---|---|---|---|---|---|---|---|
| 1.000 | 3.900 | 1,1 | 2,3 | ~US$0 | US$0 | ~US$0 | ~US$0,5 |
| 10.000 | 39.000 | 11,3 | 23 | US$0,17 | US$0,02 | ~US$0,5 | ~US$5 |
| 100.000 | 390.000 | 113 | 234 | **US$1,70** | US$1,55 | ~US$18 | ~US$51 |

En el caso pesimista (100.000 usuarios, el 60 % en retos, una foto diaria de 0,5 MB y 60 días de vida) son
1,8 TB: US$27 al mes en Railway, unos US$31 en R2 y más de US$200 en S3. **Guardar es casi gratis; lo caro
es moderar en el servidor**: [Rekognition](https://aws.amazon.com/rekognition/pricing/) cobra US$1 por
1.000 imágenes (unos US$39 al mes con 10.000 usuarios y US$390 con 100.000), y solo en la opción A.

## 3. Privacidad y cifrado: la decisión central

**`expo-crypto` 57** ([docs](https://docs.expo.dev/versions/v57.0.0/sdk/crypto/)) trae SHA, números
aleatorios y AES-GCM, que ya usa `backupCrypto.ts`. **No trae nada asimétrico**: ni ECDH, ni X25519, ni
HKDF, ni HMAC. Para B hacen falta `@noble/curves` (X25519) y `@noble/hashes` (HKDF).
`react-native-quick-crypto` también tiene X25519, pero es nativa y mucho más pesada. El AES de las fotos
sigue siendo el nativo, con la misma interfaz `AesEngine` y los tests sobre WebCrypto.

| | A: el servidor ve las fotos | B: de extremo a extremo |
|---|---|---|
| Qué guarda el servidor | JPEG legibles en un bucket privado | Bytes que no puede abrir, más quién subió, cuándo, a qué reto y cuánto pesa |
| Moderación | Puede escanear (Rekognition, [PhotoDNA](https://www.microsoft.com/en-us/photodna/cloudservice), gratis si aprueban la solicitud) y revisar un reporte | Solo por reporte: quien reporta entrega la llave de esa foto |
| Regla 7 y ADR-0048 | Cumple la letra (“lo que comparte con su círculo”), pero rompe la historia del producto: el servidor que “no puede leer” tu respaldo sí ve tu cara en el gimnasio | Coherente con el respaldo y con “nada viaja en claro” |
| Fichas de datos | Declarar “Fotos”, recolectadas y vinculadas | Play: *"unreadable by you … as a result of end-to-end encryption does not need to be disclosed"* ([Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)). Apple define recolectar como guardar *"in a readable form"* ([App Privacy](https://developer.apple.com/app-store/app-privacy-details/)) |
| Filtración de la base y el bucket | Expone fotos de personas (dato sensible según la SIC, §4) | Expone metadatos |
| Llave perdida | Nada se pierde | La foto se pierde, y con vida corta el daño es menor |
| Esfuerzo | Base | +6 a 9 días y una dependencia JS |

**El diseño B que propongo**, pensado para caber en el modelo “cada fila tiene un dueño” del ADR-0033:

1. **Llave de caja por identidad.** `sk = SHA-256("vesper-box-v1:" + secreto)`, el mismo patrón que la llave
   del respaldo. X25519 la ajusta sola. El servidor guarda `SHA-256(secreto)` sin etiqueta, así que de ahí
   no puede derivarla. La llave no se guarda en ningún lado: viaja con el secreto por los tres caminos
   (llavero de iCloud o Block Store, la clave de respaldo y el correo). La pública sube en `POST /device`
   y baja en `members[].boxKey`.
2. **Una llave por emisor y por reto, con época** (*sender keys*, como los grupos de WhatsApp). Cada
   participante crea su propia llave de 32 bytes para el reto y la envuelve para cada participante con
   X25519 estático (la suya y la del otro) → HKDF con `info = reto|emisor|época|destinatario` → AES-GCM.
   Cada envoltura es una fila **del emisor**, que se sube por `/sync` como las marcas. Nadie depende de
   que otro esté en línea para publicar lo suyo, y en un reto de 12 son como mucho 144 envolturas.
3. **Una llave por foto.** La foto y su miniatura se cifran con AES-256-GCM y una llave propia, con
   `mediaId|reto|dueño|variante` como dato autenticado. Esa llave va envuelta con la del emisor dentro de
   la fila de la foto.
4. **Alguien entra tarde:** cada emisor lo envuelve en su siguiente sync (el servidor devuelve
   `needsWrap`). Mientras tanto, esas fotos dicen “aparecen cuando Ana abra Vesper”. Si ve las fotos
   anteriores o solo las nuevas lo decide el producto; las dos formas son posibles.
5. **Alguien sale del reto o se termina un vínculo (ADR-0049):** el servidor deja de firmarle URL (ese es
   el control real) y borra sus fotos de ese reto. Cada emisor sube de época al publicar otra vez.
6. **El secreto rota al restaurar (ADR-0048 §5):** la restauración ya usa las credenciales viejas antes de
   rotar. Se agrega un paso: abrir las envolturas con la llave vieja, guardar las llaves de emisor en SQLite
   (también viajan en el respaldo) y publicar la llave pública nueva. Los demás vuelven a envolver en su
   siguiente sync.
7. **Segundo dispositivo (ADR-0050):** es un dispositivo activo por identidad. “Traerlo aquí” es el caso 6,
   y “Empezar aparte” es otra identidad. Nada multidispositivo, que es la parte más difícil de B.
8. **Reporte verificable.** Quien reporta manda **la llave de esa foto**, no la del emisor. El servidor abre
   el cifrado que el dueño subió con su sesión, y la etiqueta GCM prueba de quién es. El efecto es el del
   *franking* de Messenger, sin criptografía nueva; WhatsApp [reenvía los últimos mensajes](https://en.wikipedia.org/wiki/Reception_and_criticism_of_WhatsApp_security_and_privacy_features)
   de un chat reportado.
9. **Confianza en las llaves.** Las publica el servidor, así que un operador malicioso podría meter la suya.
   Se fija la primera llave vista y un cambio se dice en una línea (“Ana restauró su Vesper”). Comparar
   huellas en persona queda para la fase 2.

**Dos precios que hay que escribir, no esconder:**

- **El correo de recuperación debilita el cifrado del grupo.** Quien lo activa deja su secreto en custodia
  (ADR-0050), así que quien tenga `RECOVERY_KEY` y la base podría derivar su llave y abrir **todas** las
  fotos de sus retos, también las de los demás. Es el mismo caso de WhatsApp con un participante que
  respalda sin cifrar. La privacidad debe decirlo.
- Sin identidad, sin respaldo y sin correo, las fotos vigentes se pierden. Con fotos que duran semanas es
  un costo aceptable.

**Precedentes.** [Day One](https://dayoneapp.com/shared-journals/privacy/) cifra de extremo a extremo sus
diarios compartidos, con una llave por diario y hasta 30 miembros. WhatsApp y Signal usan *sender keys* y
cambian las llaves cuando alguien sale; [MLS (RFC 9420)](https://www.rfc-editor.org/info/rfc9420/) sobra
para 12 personas. [Locket Widget](https://locket.camera/privacy) **no** cifra de extremo a extremo, revisa
lo reportado y avisa que una foto enviada no se borra de otros teléfonos. Esa advertencia también vale
aquí.

**Recomendación: B.** Encaja con el producto, con el respaldo y con las fichas, por 6 a 9 días y una
dependencia auditada. Su moderación (un reporte que revela la llave de una foto, bloqueo y respuesta en
24 h) cubre lo que piden las tiendas. Renuncia a escanear por su cuenta, algo que la ley de EE. UU. no
exige.

## 4. Cumplimiento y tiendas

**Apple 1.2** ([guías](https://developer.apple.com/app-store/review/guidelines/)) pide filtro, reporte con
respuesta oportuna, bloqueo y contacto publicado. El rechazo habitual ([ejemplo](https://github.com/QuickBlox/q-municate-ios/issues/320))
agrega términos que prohíban el contenido objetable y **actuar sobre un reporte en menos de 24 h, borrando
el contenido y expulsando a quien lo subió**. Invitar no exime. En B, el filtro no puede ser un escaneo del
servidor: es estructural (solo participantes aceptados, ocultar, quitar) y, en la fase 2, local con
[SensitiveContentAnalysis](https://developer.apple.com/documentation/sensitivecontentanalysis) en iOS, que
pide entitlement y solo actúa si la persona activó “Aviso de contenido sensible”. **Es el mayor riesgo de
rechazo.** Se mitiga con notas para el revisor y un reto de demostración que ya tenga fotos.

**Clasificación por edad de Apple.** Las respuestas al cuestionario nuevo [son obligatorias desde
septiembre de 2026](https://developer.apple.com/news/?id=tlur8uvi). En [las definiciones](https://developer.apple.com/help/app-store-connect/reference/age-ratings),
*User-Generated Content* y *Messaging and Chat* quedan en 4+, y *Social Media* (*"a social feed or similar
discovery method that visibly spreads content to many users"*) sube el mínimo a 13+. Una grilla por reto
para 12 invitados es UGC sí y Social Media no, siempre que nunca aparezca un “todas las fotos de tu
círculo” cronológico: sería un feed y rompería la regla 11.

**Google Play.** La [política de UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)
aplica a *"at least a subset of the app's users"*. Exige aceptar términos **antes** de subir, reportar y
bloquear dentro de la app, y moderar. La [Child Safety Standards](https://support.google.com/googleplay/android-developer/answer/14747720?hl=en)
obliga a las categorías Social y Citas; Vesper (Productividad o Salud y bienestar) queda fuera, pero cumplir
es barato: normas CSAE publicadas, contacto de seguridad infantil y proceso para reportar a NCMEC.

**Abuso sexual infantil (CSAM).**
- **EE. UU.** Según [18 U.S.C. §2258A](https://uscode.house.gov/view.xhtml?req=granuleid%3AUSC-prelim-title18-section2258A&num=0&edition=prelim),
  no hay obligación de monitorear, pero sí de reportar a NCMEC en cuanto se tiene **conocimiento real**
  (un reporte con la imagen lo es). Con la [REPORT Act](https://www.orrick.com/en/Insights/2024/01/REPORT-Act-Expands-Online-Service-Provider-Obligations-Related-to-Child-Sex-Abuse-Material),
  el material se conserva un año y las multas por no reportar a sabiendas suben a entre US$600.000 y
  850.000. Hay que registrarse como proveedor en CyberTipline **antes** de publicar. Con o sin cifrado de
  extremo a extremo, la obligación es la misma: B solo cambia de dónde viene el conocimiento.
- **UE.** La excepción temporal que *permite* escanear de forma voluntaria [se extendió hasta el 3 de
  abril de 2028, con una exención para lo cifrado de extremo a extremo](https://brusselssignal.eu/2026/07/european-parliament-approves-mini-chat-control/);
  el reglamento permanente sigue en negociación. Hoy no obliga a Vesper a escanear.
- **Colombia.** Los [arts. 7 y 8 de la Ley 679 de 2001](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=18309)
  prohíben alojar ese material y obligan a denunciar lo que se conozca.

**Colombia, Ley 1581 de 2012.** La imagen de una persona identificable es dato personal y, según varios
análisis, [dato biométrico sensible](https://propintel.uexternado.edu.co/derecho-de-imagen-en-la-ley-de-proteccion-de-datos-personales/):
pide autorización previa, expresa e informada ([guía de la SIC](https://sedeelectronica.sic.gov.co/noticias/sic-expide-guia-para-el-correcto-tratamiento-de-las-fotografias-como-datos-personales)).
Quien sube la foto no siempre es quien aparece, y puede aparecer un menor. La [Ley 2489 de 2025](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=260756)
(Decreto 0769 de 2026) pide minimizar los datos de menores. B reduce el tratamiento pero no lo elimina: los
términos piden subir solo fotos propias o con permiso, y el borrado se atiende. **Lo revisa alguien con
criterio legal**, como ya dice ADR-0046.

| Antes de publicar (obligatorio) | Deseable |
|---|---|
| Términos con tolerancia cero, aceptados antes de la primera foto | SensitiveContentAnalysis en iOS |
| Reportar (foto o persona), ocultar y bloquear dentro de la app | Huella de llaves para verificar en persona |
| Proceso escrito de 24 h, correo de contacto y de seguridad infantil | Normas CSAE publicadas aunque Play no las exija |
| Registro de proveedor en NCMEC y conservación de un año de lo reportado | Informe de transparencia anual |
| Privacidad (`web/privacidad`): qué se sube, cifrado, vida, borrado y el precio del correo | |
| App Privacy y Data safety: con A, “Fotos”; con B, nada, y el cifrado declarado | |
| Cuestionario de edad: UGC sí, Social Media no | |
| Borrar la cuenta borra las fotos (5.1.1(v) y la [eliminación de cuenta de Play](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)) | |

## 5. Encaje con lo que ya existe

**Servidor.** Tablas nuevas en `schema.sql`, todas con `on delete cascade` hacia `accounts` y `challenges`:

```sql
box_keys     (account_id pk, public_key, updated_at)
sender_keys  (challenge_id, sender_id, epoch, recipient_id, wrapped, created_at, pk(...))
media        (id pk uuidv7, challenge_id, owner_id, day_key, epoch, wrapped_dek,
              full_size, thumb_size, width, height, created_at, updated_at,
              deleted_at null, expires_at)       -- una viva por (reto, dueño, día)
reports      (id, reporter_id, media_id|member_id, reason, created_at, resolved_at)
blocks       (blocker_id, blocked_id, created_at)
```

Rutas: `PUT /media/:id` y `/media/:id/thumb`, `GET /media/:id/url` (URL firmada en JSON),
`DELETE /media/:id`, `POST /report` y `POST /block`. Los objetos viven en `m/<dueño>/<mediaId>/{full,thumb}`
y se firman con [`aws4fetch`](https://github.com/mhart/aws4fetch) (pocos KB, solo en el servidor).
`MemoryStore` gana objetos en memoria, así que los tests siguen sin red.

**`/sync`.** Las filas `media` bajan por el cursor, **con lápidas** (`deleted_at`), porque el ADR-0049 ya
mostró que el cursor no ve lo borrado. Las envolturas suben como filas del emisor; bajan `senderKeys`,
`boxKeys` y `needsWrap`. La foto viaja en su `PUT`, no en `/sync`.

**Borrado en cascada.**

| Evento | Servidor | Teléfonos |
|---|---|---|
| Borrar la cuenta | Filas en cascada y objetos del prefijo `m/<dueño>/` | Hoy no se avisa (ADR-0049): hace falta una lápida sin FK a `accounts`, o esperar al vencimiento local |
| Salir del reto o terminar un vínculo | Borra sus fotos de esos retos y deja de firmarle | Lápidas, y la caché se borra |
| Cierre + 7 días (retos sin fin: 30 días por foto) | Barrido cada hora en el mismo proceso y conciliación semanal con el bucket | Cada teléfono vence las fotos por su cuenta |
| Borrar una foto propia | Objeto y lápida | Se va en el siguiente sync; quien ya la vio pudo guardarla, y se dice |

**Respaldo.** Las fotos **no** van en el blob: es JSON (base64 suma un 33 %), el tope de 5 MB son unas 20
fotos y se sube entero cada día. Viajan las filas `media` y las llaves, y al restaurar las fotos vigentes
se bajan del bucket. En la fase 0 la pantalla dice que no se respaldan y ofrece guardarlas en Fotos.

**Avisos.** Ninguno por foto, ni siquiera un push silencioso: llegan con el sync de siempre (ADR-0044 §4).
El presupuesto del ADR-0027 no se toca.

**Sin red.** La foto procesada se guarda en `Paths.document` con una fila en `media_outbox` (migración 011)
y se ve al instante. Se cifra **al subir**, con la época de ese momento; la marca viaja aparte, como hoy.

**UI.** Componentes nuevos en `design/components` (`PhotoTile`, `PhotoViewer`, `PhotoCollage`), regla 3.
“Agregar foto” es una fila o un `ghost` (regla 2). Sin “me gusta”, sin contadores y sin otro orden que el
día (regla 11). **El collage de cierre** va dentro de la app con todas las fotos, y **afuera solo con las
propias**, porque ADR-0030 §1 prohíbe sacar a otras personas.

## 6. Video e “historias”: no por ahora

- **Peso y servidor:** 10 s a 720p son de 1,5 a 3 MB, entre 10 y 15 fotos. Guardarlos sigue saliendo barato
  en Railway (Cloudflare Stream: [US$5 por 1.000 min guardados y US$1 por 1.000 entregados](https://developers.cloudflare.com/stream/pricing/)),
  pero Stream y Mux transcodifican en el servidor, algo **incompatible con B**.
- **Teléfono:** `ffmpeg-kit` [está retirado desde 2025](https://tanersener.medium.com/saying-goodbye-to-ffmpegkit-33ae939767e1);
  queda `videoExportPreset` en iOS y poco control en Android. Además `expo-video`, el micrófono y reportes
  que manden el video completo.
- **Producto:** una historia se consume en secuencia, con barras de progreso animadas (reglas 6 y 11).

**No.** Si las fotos se usan, se puede evaluar después un clip de 3 s sin audio, como una Live Photo.

## 7. Fases, esfuerzo y riesgos

Días de trabajo de una persona que ya conoce el repo, con tests, i18n, STATUS y ADR:

| Fase | Qué | Días |
|---|---|---|
| **0** | Foto opcional en tu marca del día, solo local (picker, manipulador, EXIF quitado y testeado, migración, grilla y visor) y collage de tus fotos al cierre por la hoja del sistema. Nada sale del teléfono: **sin UGC, sin fichas nuevas**, solo el texto del permiso de cámara | 7–10 (+2–3 si ADR-0030 no está hecho) |
| **1** | Las fotos visibles para los participantes, con cifrado: bucket, tablas, rutas, barrido y reporte/bloqueo en el servidor (6–8); criptografía en el cliente (4–6); sync, cola de subida, caché, lápidas y restauración (5–7); UI de reportar, ocultar, bloquear y aceptar términos (3–5); textos legales, fichas y NCMEC (2–3); verificación con dos dispositivos (2–3) | 20–30 (A: 6–9 menos de cripto, +2–3 de moderación automática y su costo mensual) |
| **2** | Collage del grupo dentro de la app, pie de 80 caracteres cifrado, SensitiveContentAnalysis en iOS y huella de llaves | 8–12 |

| Riesgo | Cómo verificarlo |
|---|---|
| Se filtra GPS o EXIF | Test de `stripJpegMetadata` con una muestra que traiga GPS; `exiftool` sobre archivos sacados con `xcrun simctl get_app_container` y `adb pull` |
| Orientación equivocada | Fotos en vertical y horizontal: fototeca del simulador y cámara virtual del emulador |
| `@noble/curves` v2 (solo ESM, BigInt) en Metro y Hermes | Medir en el dev client de Android (el objetivo es menos de 50 ms por envoltura); si falla, v1 sigue mantenida |
| Perder llaves al rotar | Escenarios en vitest con `MemoryStore` (restaurar, entrar tarde, salir, terminar un vínculo); restaurar en un segundo simulador contra el servidor local |
| URL firmadas de Tigris (vencimiento, cabeceras) | Un bucket en un entorno `staging` de Railway; el servidor local sigue en memoria |
| Rechazo por la 1.2 | Notas para el revisor, reto de demostración y proceso de 24 h escrito antes de enviar |
| Objetos huérfanos (sin ciclo de vida) | Conciliación semanal con un test del barrido |
| Selector de Android en API 26–29 | Emuladores API 26 y 29 con los permisos de almacenamiento bloqueados |
| Consumo de memoria en la grilla | Solo miniaturas en la grilla; la foto completa, al tocarla |

**Orden sugerido.** Primero un ADR para la fase 0, que no toca ninguna regla dura. Sin telemetría (ADR-0033),
la pregunta de si las fotos importan se contesta hablando con quien la usa. Si importan, otro ADR para la
fase 1: enmienda la regla 7 para nombrar las fotos cifradas, agrega el bucket (todo backend nuevo pide ADR)
y deja por escrito el precio del correo de recuperación. La fase 1 no sale a las tiendas sin reportar,
bloquear, términos y registro en NCMEC.
