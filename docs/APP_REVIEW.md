# Revisión en las tiendas con fotos en los retos

Lo que hay que pegar o contestar en App Store Connect y en Play Console desde que un reto
lleva fotos compartidas (ADR-0051, tanda 2). Escrito el 2026-09-26 contra la guía de la
tanda 2; si el código cambia, este documento cambia en el mismo commit. Las citas de Apple y
de Google se leyeron en sus páginas ese día.

**No es asesoría legal.** Lo que un abogado o el dueño tienen que confirmar va marcado
**[REVISAR]**. El proceso que respalda la promesa de 24 horas está en `docs/MODERATION.md`;
lo de Play (Data safety, permisos, UGC) está en `docs/PLAY_DECLARATIONS.md`.

## 1. Por qué esto es el mayor riesgo de rechazo

La [guía 1.2 de Apple](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)
pide, a toda app con contenido de usuarios:

> - A method for filtering objectionable material from being posted to the app
> - A mechanism to report offensive content and timely responses to concerns
> - The ability to block abusive users from the service
> - Published contact information so users can easily reach you

Y cuando rechaza, Apple suele pedir además términos con tolerancia cero aceptados antes de
publicar y actuar sobre un reporte *"within 24 hours by removing the content and ejecting
the user who provided the offending content"*
([ejemplo](https://github.com/QuickBlox/q-municate-ios/issues/320)).

Con cifrado de extremo a extremo el primer punto no puede ser un escaneo en el servidor. El
filtro es **estructural**, y las notas tienen que explicarlo antes de que el revisor lo
pregunte:

| Lo que pide Apple | Cómo lo cumple Vesper |
|---|---|
| Filtro | Solo ven y suben fotos quienes entraron por invitación aceptada al círculo **y** se unieron a ese reto. Sin perfil público, feed, búsqueda, seguidores, comentarios, reacciones ni mensajes. Quien crea el reto decide si lleva fotos. Una foto por persona y día, solo en un día marcado, y vive semanas |
| Términos antes de publicar | `circle/photo-terms`: pantalla completa antes de la primera foto compartida, con la línea de tolerancia cero y el enlace a los Términos. Sin «Entendido» no sale ninguna foto |
| Reportar | «…» en el visor › «Reportar la foto», con cuatro motivos y nota. Se oculta en el acto y manda la llave de esa foto para revisarla |
| Respuesta oportuna | Revisión en menos de 24 horas: quitar la foto para todos y vetar la cuenta (`docs/MODERATION.md`) |
| Bloquear | «Bloquear a {nombre}» en el visor y en la lista del círculo, junto a «Quitar». «Ocultar las fotos de {nombre}» además |
| Contacto publicado | gusmoreno.dev@gmail.com en Términos y Privacidad, enlazados desde Ajustes › Acerca de Vesper |

## 2. Notas para el revisor de Apple

App Store Connect › la versión › **App Review Information › Notes**. No hace falta cuenta
de demostración: la app no tiene login.

**Antes de enviar hace falta que la semilla de demostración traiga fotos** de Ana y de Luis
en el reto «Leer», y que «Reportar», «Ocultar» y «Bloquear» funcionen sobre personas de
ejemplo sin llamar al servidor **[REVISAR: hoy la semilla tiene el reto con fotos encendidas,
pero ninguna foto]**. Sin eso, el revisor no puede ver el flujo con un solo teléfono. Grabar
además un video corto del flujo real entre dos teléfonos y adjuntarlo a las notas.

> **User-generated content (Guideline 1.2)**
>
> Vesper is a focus app. Its only user-generated content is an optional photo a person can pin to a day they marked in a challenge. A challenge belongs to a private circle of at most 12 people who joined by mutual invitation: a code from someone they know, which that person must accept. There is no public profile, no feed, no search or discovery, no followers, no comments, no reactions and no direct messages. A photo is visible only to the people who were already in that challenge when it was added (someone its creator added sees it once they join), and it is deleted from our server 14 days after the challenge ends (28 days per photo in a challenge with no end date).
>
> Photos are end-to-end encrypted, so our server stores bytes it cannot open and the filter cannot be a server-side scan. It is structural, and it works together with reporting:
>
> 1. Only accepted participants. Nobody can see or add photos without being invited and accepted into that circle and joining that challenge. Whoever creates a challenge decides whether it takes photos at all.
> 2. Terms before the first upload. Before a person's first shared photo, a full-screen notice says who sees it, how long it stays, what to mind, and our zero-tolerance rule for objectionable content, with a link to the Terms. Nothing is uploaded until they tap "Got it". Terms: https://vesper-azure.vercel.app/terms?lang=en#photos
> 3. Report. Every photo from someone else has a "…" menu with "Report the photo" (It should not be here · Someone is in it without consent · It shows a minor · Something else, plus an optional note). The photo is hidden for the reporter at once, the reporter stays anonymous, and the phone sends us the key to that one photo so we can review it.
> 4. Hide and block. "Hide [name]'s photos" hides them for that person only. "Block [name]" ends the connection, removes them from the person's circle and challenges, and stops them from asking to join again. Block is also in the circle's member list, next to "Remove".
> 5. We act within 24 hours. Every report is reviewed within 24 hours. Objectionable content is removed for everyone and the account that posted it is banned: all its photos are deleted and it cannot post again. Child sexual abuse material is preserved and reported to NCMEC and to the Colombian authorities.
> 6. Contact: gusmoreno.dev@gmail.com, published in the Terms and the Privacy Policy, both linked from Settings › About Vesper.
>
> **How to see it with one device.** The app starts with demo data, removable in Settings. Go to Settings › Circle › See circle › the "Read" challenge. Ana's and Luis's marked days show photo thumbnails. Tap one to open it, then "…" to try "Report the photo", "Hide Ana's photos" and "Block Ana". The demo circle lives only on the device, so a report there reaches no server. To add your own photo, mark today in the same challenge and use the "Add today's photo" row: in the demo nobody else can receive it, so it stays on the device.
>
> The attached video shows the same flow between two real devices, including the notice before the first photo and a report reaching our moderation queue.
>
> **Account deletion (5.1.1(v)).** There is no sign-up: an anonymous account is created on first launch. It is deleted in Settings › Circle › Delete the account, or with Settings › Delete everything and start over, which also deletes its photos from the server.

*Para uso interno, en corto: el único contenido de usuarios es una foto opcional pegada a un
día marcado de un reto; el reto es de un círculo privado de hasta 12 personas por invitación
aceptada; sin perfil público, feed, búsqueda, seguidores, comentarios, reacciones ni
mensajes. Cifrado de extremo a extremo, así que el filtro es estructural: solo participantes
aceptados, términos antes de la primera foto, reportar (oculta y manda la llave de esa foto),
ocultar y bloquear, y respuesta en 24 horas que quita la foto y veta la cuenta; lo de un menor
se conserva y se reporta a NCMEC y a Colombia. Se prueba con los datos de ejemplo: Ajustes ›
Círculo › Ver círculo › «Leer» › una foto de Ana › «…». Borrar la cuenta: Ajustes › Círculo ›
Borrar la cuenta, o Borrar todo y reiniciar.*

Dos cosas que las notas prometen y que dependen de otros:

- **"The account that posted it is banned"**: hoy `ban` quita todas las fotos de la cuenta y
  le impide subir más, pero no la saca del círculo de nadie. Alcanza para lo que pide Apple
  si se lee "ejecting" como sacarla de las fotos; si un revisor pide más, hace falta cerrar
  la cuenta desde `/admin` (`docs/MODERATION.md`, pendientes del servidor).
- **El enlace `#photos`** existe en `web/terms.html` desde esta tanda; la pantalla del aviso
  hoy enlaza `/terms` sin ancla.

## 3. Clasificación por edad

### Apple

Las respuestas al cuestionario nuevo [son obligatorias desde septiembre de
2026](https://developer.apple.com/news/?id=tlur8uvi). Definiciones de
[Age ratings](https://developer.apple.com/help/app-store-connect/reference/age-ratings).
Solo cambia lo que tocan las fotos; el resto del cuestionario sigue como esté.

| Pregunta | Respuesta | Por qué |
|---|---|---|
| **User-Generated Content** | **Yes** | *"Includes the broad distribution of content created by users as a component of the app's intended user experience."* La difusión de Vesper es estrecha (hasta 12 invitados), y aun así se contesta que sí: queda en 4+, es coherente con las notas de la 1.2 y evita que el revisor encuentre fotos que el cuestionario negó |
| **Social Media** | **No** | *"Redistribution, amplification, or interaction with user-generated content through a social feed or similar discovery method that visibly spreads content to many users. May include: feeds that allow users to engage with and amplify user-generated content through features such as views, likes, comments, and shares."* Vesper no tiene feed, ni descubrimiento, ni vistas, me gusta, comentarios o compartir: una grilla por reto, ordenada por persona y día. **Si algún día aparece una vista con "todas las fotos de tu círculo" por novedad, la respuesta pasa a Yes (13+) y se rompe la regla 11** |
| **Messaging and Chat** | **No** | *"Users can directly communicate with one another through features within the app. May include: text, voice and/or video chat, direct and/or group messaging, or public posting."* No hay texto que una persona le mande a otra: el ánimo y el empujón son gestos fijos sin palabras, y el pie de 80 caracteres va pegado a una foto, no a una persona, sin respuestas. **[REVISAR: un revisor estricto podría leer el pie como mensaje de grupo. Contestar Yes también deja 4+, así que la duda no cambia la edad]** |
| Unrestricted Web Access | No | Términos y Privacidad se abren en el navegador del sistema (`Linking.openURL`), no dentro de la app |
| Advertising | No | Sin anuncios |
| Parental Controls · Age Assurance | No · No | La app no es control parental y no verifica edad |
| Contenido sexual, violencia y demás descriptores | None | Describen lo que la app contiene, no lo que sus términos prohíben. Lo que alguien suba contra los términos se quita |

Con solo UGC en *Capabilities*, la definición de 4+ dice: *"may contain instances of the
following content that may not be suitable for children under the age of 4: Capabilities:
User-generated content"*. Los Términos siguen diciendo que Vesper es para mayores de 18: eso
no es la clasificación de la tienda **[REVISAR: si conviene contestar el resto del
cuestionario para que la edad refleje el público de 18+]**.

### Google Play (IARC)

Play Console › Política › Contenido de la app › **Clasificación del contenido**.

| Pregunta | Respuesta | Por qué |
|---|---|---|
| Categoría | **Utility, Productivity, Communication, or Other** | [La de Play](https://support.google.com/googleplay/android-developer/answer/6159978?hl=en) para productividad; no es una red social |
| Online interaction or content exchange | **Sí** | Play pide que sí cuando *"users can freely exchange content that they have created. This includes the ability to communicate between users, comment on provided content, share photos or exchange any other type of content created by users"* ([ayuda](https://support.google.com/googleplay/android-developer/answer/7021383?hl=en-GB)). La ficha mostrará que los usuarios interactúan |
| Comparte la ubicación del usuario | No | La foto sale sin metadatos; la app no lee la ubicación |
| Compras digitales | No | — |

Público objetivo (Contenido de la app › **Público objetivo y contenido**): sigue en 18 años
o más, sin cambios.

## 4. App Privacy (Apple)

Apple define recolectar así ([App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)):

> "Collect" refers to transmitting data off the device and storing it in a readable form for
> longer than the time it takes you and/or your third-party partners to service the request.

Y agrega que *"Data that is processed only on device is not 'collected'"*. Con eso:

- **Una foto que nadie reportó no se recolecta**: sale del teléfono, pero el servidor la
  guarda de una forma que no puede leer.
- **Una foto reportada sí**: el reporte trae su llave, el servidor la puede abrir y, si es
  abuso de un menor, la guarda legible hasta 365 días.
- **Las fotos de quien dio un correo de recuperación**, en principio también: el servidor
  guarda lo que haría falta para abrirlas (ADR-0050), aunque no lo haga.
- **Los datos en claro de cada foto** (quién la subió, reto, día, medidas, peso, origen,
  fechas, para quién va) sí se recolectan, y están vinculados a la cuenta.

La declaración opcional no alcanza: Apple exige que se cumplan los cuatro criterios, y el
último pide que *"the user's name or account name is prominently displayed in the submission
form alongside the other data elements being submitted, and the user affirmatively chooses
to provide the data for collection each time"*. Un reporte manda la foto de otra persona y es
anónimo, así que no lo cumple.

**Recomendación: declarar las fotos**, aunque la mayoría nunca se pueda leer. Apple pide
*"You need to identify all of the data you or your third-party partners collect, unless the
data meets all of the criteria for optional disclosure"*: declarar de más solo hace la
etiqueta más larga, y declarar de menos la vuelve falsa. **[REVISAR]**

| Tipo de dato de Apple | Antes de las fotos | Con las fotos | Vinculado | Rastreo | Propósito |
|---|---|---|---|---|---|
| User Content › **Photos or Videos** | — | **Nuevo**: las fotos reportadas y, en principio, las de quien dio un correo de recuperación | Sí | No | App Functionality (*"implement security measures"*) |
| User Content › Other User Content | El respaldo cifrado | Además el pie de las fotos (mismo caso que la foto) y los datos en claro de cada foto | Sí | No | App Functionality |
| Identifiers › User ID | El id anónimo | Sin cambio: la lista de destinatarios de una foto son ids | Sí | No | App Functionality, Analytics |
| Health & Fitness · Contact Info › Name · Contact Info › Email Address | Como estaban (`docs/PLAY_DECLARATIONS.md`, pendientes) | Sin cambio | Sí | No | Como estaban |

**Actualizaciones por el aire (ADR-0052).** EAS Update es un *third-party partner*: recibe
la consulta de cada arranque y no sabemos cuánto la guarda, así que se declara lo que lleva,
aunque Vesper no lo reciba nunca.

| Tipo de dato de Apple | Qué es | Vinculado | Rastreo | Propósito |
|---|---|---|---|---|
| Identifiers › Device ID | `EAS-Client-ID`: un UUID al azar por instalación que crea `expo-eas-client`. No se cruza con la identidad de Vesper | No | No | App Functionality |
| Diagnostics › Crash Data | El texto de una caída en los diez segundos siguientes a abrir, hasta 1024 caracteres, que viaja en la consulta siguiente | No | No | App Functionality |

**[REVISAR]** si Apple cuenta un id por instalación que no es de hardware como *Device ID* o
como *Other Data*. Declararlo de más solo alarga la etiqueta.

La URL de privacidad en App Store Connect es https://vesper-azure.vercel.app/privacy, que desde
esta tanda tiene la sección de fotos.

**Permisos en iOS** (`locales/*.json`): `NSCameraUsageDescription` («Vesper usa la cámara solo
cuando decides agregar una foto a un día de un reto») se pide al tocar «Tomar una foto». La
galería se abre con PHPicker y no pide permiso; `NSPhotoLibraryUsageDescription` está porque el
módulo la declara.

## 5. Lo que un abogado debería mirar antes de publicar

1. **Ley 1581 de 2012** para la imagen de una persona: si la aceptación del aviso de la
   primera foto es una autorización previa, expresa e informada suficiente para un dato que
   puede ser sensible (la cara), y cómo se trata a quien aparece en una foto sin ser quien la
   subió. La [guía de la SIC sobre fotografías](https://sedeelectronica.sic.gov.co/noticias/sic-expide-guia-para-el-correcto-tratamiento-de-las-fotografias-como-datos-personales).
2. **Menores**: el art. 7 de la Ley 1581, la Ley 2489 de 2025 y su Decreto 0769 de 2026, y
   la regla de los Términos ("salvo que seas quien lo cuida").
3. **18 U.S.C. §2258A** ([texto](https://www.law.cornell.edu/uscode/text/18/2258A)): si
   obliga a un responsable en Colombia con el servidor en EE. UU., o si el reporte a NCMEC es
   voluntario; cómo conservar lo reportado (*"in a secure location"*, marco de NIST) y qué
   implica que el moderador tenga una copia local mientras reporta.
4. **Ley 679 de 2001, arts. 7 y 8**: ante quién denuncia un proveedor en Colombia.
5. **El responsable del tratamiento** (`[TITULAR]`) y lo que el Decreto 1377 de 2013 pide en
   una política de tratamiento: identificación, domicilio, canal y fecha de vigencia.
6. **Encargados y transmisión internacional**: Railway (servidor y fotos), Neon (base, en
   EE. UU.), Resend (correo) y Expo (avisos y actualizaciones, ADR-0052). La privacidad nombra a Railway, Resend y Expo,
   no a Neon.
7. **La frase "No abrimos fotos por ese camino"** del precio del correo de recuperación,
   frente a una orden de una autoridad.
8. **Cuánto se guarda el registro de moderación** y lo que contiene.
9. **El Registro Nacional de Bases de Datos de la SIC**, que probablemente no aplica a una
   persona natural.

## 6. Antes de enviar

- [ ] Fotos de ejemplo en la semilla de demostración, con «Reportar», «Ocultar» y «Bloquear»
  funcionando sobre personas de ejemplo sin servidor.
- [ ] Video corto del flujo real con dos teléfonos, adjunto a las notas.
- [ ] Todo lo de "Una sola vez" de `docs/MODERATION.md`: NCMEC, `ADMIN_TOKEN`, el bucket,
  el correo de seguridad infantil y el recordatorio de las dos revisiones diarias.
- [ ] `web/` desplegado con esta privacidad y estos términos (`vercel deploy --prod` desde
  `web/`), con `[TITULAR]` y la fecha de vigencia puestos.
- [ ] Cuestionario de edad (§3) y App Privacy (§4) contestados.
- [ ] La revisión legal de §5.
