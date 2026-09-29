# Strava: leer las actividades con su API directa

Informe técnico y de términos · 2026-09-29 · sin cambios al repo

Leído contra `CLAUDE.md` (reglas 7, 9 y 11), ADR-0042, `web/privacy.html`, `docs/APP_REVIEW.md`,
`docs/PLAY_DECLARATIONS.md` y `src/platform/health.*.ts`. Rigen el **Acuerdo** y la **Política** de la
API de Strava, vigentes desde el 1 de junio de 2026. Las citas van en inglés, tal como están.

## Resumen

**Veredicto: ahora no.** La API de Strava sirve para marcar un hábito **personal**, pero sus términos
dicen que un dato de Strava solo se muestra a su dueño. Un reto con el círculo, que es lo que pide el
dueño, queda fuera salvo que Strava lo autorice por escrito. Además exige un servidor que guarde el
`client_secret` (enmienda la regla 7), una suscripción de Strava a nombre del desarrollador, y una
revisión sin plazo para pasar de 10 personas conectadas. **Lo que sí conviene hacer primero** es leer
el tipo de entrenamiento que ya llega de Salud y Health Connect (hoy se descarta): cubre "bicicleta un
día a la semana" y "ejercicio 3 veces por semana" sin servidor ni términos de terceros, y el círculo ya
puede verlo (ADR-0042). Strava directo, solo después y con las condiciones de §8.

## 1. Autorización en el teléfono

- **Flujo.** OAuth 2 con código de autorización. En el teléfono se abre
  `strava://oauth/mobile/authorize` si la app de Strava está instalada (versión 75 o más) y, si no,
  `https://www.strava.com/oauth/mobile/authorize` en `ASWebAuthenticationSession` (iOS) o con un intent
  implícito (Android). El `redirect_uri` debe caer dentro del *callback domain* de la app; el ejemplo de
  iOS usa un esquema propio con ese dominio como host (`YourApp://www.yourapp.com/…`)
  ([auth](https://developers.strava.com/docs/authentication/)).
- **PKCE: no está documentado.** La página no menciona `code_challenge`, y varios desarrolladores lo
  reportan como no soportado ([ejemplo](https://github.com/openzigs/onyourleft/issues/462)). Sin
  confirmar en una fuente de Strava.
- **El secreto es obligatorio** en el canje y en cada refresco de `POST /oauth/token`: *"The secret is
  used for authentication and should never be shared."* **No puede viajar en la app, así que hace falta
  un servidor.**
- **Vida de los tokens.** *"Access tokens expire six hours after they are created."* Cada refresco puede
  traer un refresh token nuevo, y *"Once a new refresh token is returned, the older refresh token is
  invalidated immediately."* Una respuesta perdida obliga a conectar otra vez: el refresh token necesita
  un solo dueño.
- **Revocar.** Desde el 1 de junio de 2026 existe `POST /oauth/revoke`, con Basic Auth de
  `client_id:client_secret`; desde el 1 de junio de 2027 será el único camino. También pide el secreto.
- **Alcances** (textuales de la misma página):

| Alcance | Qué da |
|---|---|
| `read` | *"public segments, public routes, public profile data, public posts, public events, club feeds, and leaderboards"* |
| `activity:read` | *"activities that are visible to Everyone and Followers, excluding privacy zone data"* |
| `activity:read_all` | lo anterior *"plus privacy zone data and access to read the user's activities with visibility set to Only You"* |

La persona puede desmarcar alcances, así que hay que leer el `scope` que vuelve. Con `activity:read`, lo
marcado "Only You" no cuenta; `activity:read_all` lo incluye, con zonas de privacidad que Vesper no
necesita. Recomiendo `activity:read` y decir en pantalla qué queda fuera.

## 2. Leer las actividades

`GET /athlete/activities` con `after` y `before` (epoch en segundos), `page` y `per_page` (30 por
defecto, 200 como máximo) ([referencia](https://developers.strava.com/docs/reference/),
[paginación](https://developers.strava.com/docs/)). *"Only Me activities will be filtered out unless
requested by a token with activity:read_all."* Una semana cabe en una sola llamada.

| Campo | Para qué sirve en Vesper |
|---|---|
| `sport_type` | El tipo. `type` está *"Deprecated. Prefer to use sport_type"* |
| `start_date` | Instante UTC del inicio |
| `start_date_local` | Hora local del lugar, **con una `Z` que no es UTC**: el ejemplo trae `start_date` `12:15:09Z` y `start_date_local` `05:15:09Z` |
| `timezone`, `utc_offset` | `"(GMT-08:00) America/Los_Angeles"`, `-25200` |
| `elapsed_time`, `moving_time` | Segundos; sirven para el piso de 10 minutos (`MIN_WORKOUT_MS`) |
| `manual`, `trainer`, `commute` | Creada a mano, en rodillo, trayecto |
| `device_name`, `external_id` | Qué la grabó (`"Garmin Edge 1030"`, `garmin_push_…`); importa por la atribución a Garmin (§5) |

**Qué es "bicicleta".** Entre los `sport_type` actuales: `Ride`, `MountainBikeRide`, `GravelRide`,
`EBikeRide`, `EMountainBikeRide`, `VirtualRide`, `Velomobile` y `Handcycle`. Los de motor eléctrico y
los virtuales se deciden en producto. La lista crece (seis tipos nuevos el 30 de abril de 2026, según el
[changelog](https://developers.strava.com/docs/changelog/)), así que un tipo desconocido cuenta como
"ejercicio", nunca como bicicleta.

**Qué es "manual".** Una actividad con `manual: true` la escribió la persona. Contarla como verificada
rompería la regla 9. Debe caer a declarada, o no contar.

**El día.** Lo más coherente con las marcas de Salud es tomar `start_date` como instante y sacar el día
con `dayKeyOf` de `domain/day.ts`, en la zona del teléfono. Los primeros 10 caracteres de
`start_date_local` dan el día del lugar donde ocurrió, que difiere solo cuando la persona viaja.

## 3. Webhooks o consulta

- **Webhooks** ([docs](https://developers.strava.com/docs/webhooks/)): una sola suscripción por app,
  creada con `client_id` y `client_secret`, hacia una URL pública que valida un `GET` con `hub.challenge`
  y responde `200` en menos de dos segundos. Se reintenta hasta tres veces en total.
- **Eventos:** actividad creada, borrada o con cambio de título, tipo o privacidad; y la revocación, que
  llega como evento de atleta con `"authorized": "false"`. Solo traen ids (`object_id`, `owner_id`): el
  dato hay que pedirlo aparte. Con `activity:read`, pasar una actividad a "Only You" llega como `delete`.
- **Consulta:** Strava pide webhooks, y dice que consultar es la causa común de agotar el cupo diario
  ([límites](https://developers.strava.com/docs/rate-limits/)).
- Un webhook exige servidor **con estado**: saber qué identidad de Vesper es cada `owner_id`.

## 4. Límites y capacidad

Los límites son **por aplicación**, no por persona: todos los teléfonos comparten el mismo cupo
([límites](https://developers.strava.com/docs/rate-limits/)).

| Nivel | Personas conectadas | Lecturas (15 min / día) | Total (15 min / día) | Cómo se llega |
|---|---|---|---|---|
| *Single Player Mode* | 1 (el desarrollador) | 100 / 1.000 | 200 / 2.000 | Al crear la app |
| Standard, autoservicio | 10 | 200 / 2.000 | 400 / 4.000 | Un botón en el panel, sin revisión |
| Standard revisado | hasta 9.999 | sin confirmar | sin confirmar | Formulario y revisión |
| Extended Access | 10.000 o más | sin confirmar | sin confirmar | Caso por caso, para productos comerciales |

- El cupo de 15 minutos se reinicia a los :00, :15, :30 y :45; el diario, a medianoche UTC. Pasarse
  devuelve `429`. Las cabeceras `X-ReadRateLimit-*` dicen cuánto queda.
- *"Until your app has been reviewed, you won't be able to authenticate any additional athletes to your
  app."* **La persona número 11 no puede conectarse** hasta que Strava apruebe.
- **Suscripción.** La Política §3.3 exige que en el nivel Standard *"the developer or specified end users
  maintain an active Strava subscription"*. El anuncio del 1 de junio de 2026 aclara que la paga el
  desarrollador, no quien se conecta ([anuncio](https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428),
  [FAQ](https://communityhub.strava.com/developers-knowledge-base-14/strava-api-faq-12906)). En Colombia
  cuesta COP 19.999 al mes o COP 129.900 al año ([precios](https://www.strava.com/pricing)).
- **La revisión** pide *"screenshots of all the places Strava data is shown and the 'Connect with Strava'
  button"* y advierte *"increased access is not a guarantee"*. La Política §3.6: *"Strava does not commit
  to a fixed review-time service-level agreement."* En el foro, un miembro activo resume la espera como
  *"Between 2 days with a positive response and many months without useful response"*
  ([hilo](https://communityhub.strava.com/developers-api-7/new-strava-api-update-what-the-message-means-13433)).
- **Cuentas.** Con webhooks, cuatro actividades por semana y una lectura por actividad (unas 0,6 al
  día por persona), 2.000 lecturas diarias alcanzan para unas 3.000 personas; consultando cuatro veces al
  día, para unas 500. Si el refresco de tokens cuenta, sin confirmar. La capacidad de 10 manda antes.

## 5. Lo que dicen el Acuerdo y la Política (lo decisivo)

Textos del [Acuerdo](https://www.strava.com/legal/api) y la [Política](https://www.strava.com/legal/api_policy),
*"Effective Date: June 1, 2026"*, leídos el 2026-09-29. Reemplazan el acuerdo de noviembre de 2024, que ya
había cortado mostrar datos a otros ([Strava](https://press.strava.com/articles/updates-to-stravas-api-agreement),
[DC Rainmaker](https://www.dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html)).

**Mostrar a otras personas: el círculo.**

> Política §2.3: *"Strava Data provided by a specific Strava user may be displayed or disclosed in your
> Developer Application only to that user. You may not display or disclose Strava Data related to other
> users, even if such data is publicly viewable on the Strava Platform."*

El Acuerdo dice lo mismo en su resumen. Tres frases parecen abrir una puerta:

- Acuerdo, resumen: *"This includes not sharing a Strava user's data with other users, end users of your
  application, or third parties without explicit consent."*
- Política §5.13: *"You may not use the Strava API Materials in any way that would grant anyone other
  than you or the applicable Strava user the right to see data related to that user without the prior
  express consent of that user."*
- Política §6.1: *"Unless your Developer Application has an athlete capacity of 9,999 or less, you may
  display or disclose to an end user only the specific Strava Data related to that end user."*

La §6.1, leída al pie de la letra, eximiría a las apps de hasta 9.999 personas, y choca con la §2.3. Parece
un error de redacción ([Terra](https://tryterra.co/blog/strava-api-changes-2026) aconseja pedir aclaración
antes de apoyarse en ella). "Ana marcó el martes" es un dato derivado de su actividad de Strava. **Lectura
prudente: el círculo no puede ver una marca que vino de Strava** hasta que Strava diga por escrito lo
contrario. El Acuerdo §2.2 da el camino: *"please contact us at developers@strava.com"*.

**Mezclar con otras fuentes.**

> Política §5.4: *"You may not combine Strava Data with other customer data for these or any other
> purposes."*

El título habla de analítica, pero *"or any other purposes"* alcanza, al pie de la letra, a un hábito que
suma días de Salud, de sesiones y de Strava. Otra pregunta para Strava.

**Guardar y borrar** (Política).

- §6.2: *"You may not retain Strava Data in your cache for longer than seven (7) days."*
- §6.3: *"Deletions must be reflected in your Developer Application expeditiously but in all cases
  within forty-eight (48) hours."*
- §6.4: *"you may use and retain Data only so long as necessary for the purpose for which it was
  originally obtained."*
- §7.4: al pedirlo la persona, al revocar o al borrar su cuenta de Strava, borrar *"all Strava Data and
  all Personal Data derived from Strava Data"* de todo sistema bajo tu control, *"in any event within
  thirty (30) days"*.

Si una marca de Strava cuenta como dato derivado (lo prudente), al desconectar hay que borrarla del
teléfono, del círculo y, con el tiempo, del respaldo. Si la persona borra la actividad en Strava, la marca
se va en 48 horas. Guardar la actividad cruda más de siete días está prohibido; guardar solo el día
marcado, sin confirmar.

**Consentimiento y textos.** §2.1: antes de leer, decir qué datos, cómo, cómo retirar el permiso, cómo
pedir el borrado y que se confirmará. §2.5: confirmar el borrado por escrito. §6.5: la privacidad debe
decir que Strava recoge *"Usage Data"*. §7.3: una privacidad que cumpla el GDPR. §9.2: los términos deben
excluir garantías de terceros. §8.3: avisar a Strava de una filtración en 24 horas.

**Competir con Strava.** El Acuerdo: *"You may not create applications that compete with or replicate
Strava functionality."* La Política §5.2 prohíbe todo uso *"competitive to Strava or the Strava
Platform"*. Strava vende Group Challenges a suscriptores, con hasta 199 invitados, metas y tablas
([ayuda](https://support.strava.com/en-us/articles/15401736-how-do-group-challenges-work-on-strava)), y un
reto de Vesper alimentado por Strava se le parece. Ningún texto nombra los retos virtuales; *leaderboard
data* aparece solo en la definición de *Strava Data* (Acuerdo §2.3). Es un riesgo real en la revisión.

**Lo demás.**

- IA (§5.3): prohibida hasta la *"ingestion into a context window"*. Vesper no tiene IA, pero **nadie
  del equipo debe pegar respuestas reales de la API en un asistente**; los datos de prueba se inventan.
- Cobro (§5.8): nada relacionado con Strava puede quedar detrás de un pago. Anuncios (§4.6): no se
  anuncia la integración nombrando a Strava sin su permiso escrito.
- Garmin (§4.4): lo derivado de datos de Garmin lleva la atribución que Garmin pida.
- Cambios (Acuerdo §2.1 y §3.2): Strava puede cambiar o cortar la API *"at any time (and for any
  reason)"*, y cobrar por ella.

## 6. Marca y tiendas

- **Botón.** "Connect with Strava", naranja o blanco, 48 px de alto, sin modificar, enlazado a
  `/oauth/authorize` o `/oauth/mobile/authorize` ([guía de marca](https://developers.strava.com/guidelines/),
  actualizada el 2025-09-29). Es un recurso gráfico con el naranja `#FC5200`: entra en `src/design/` como
  imagen, y hay que decidir cómo convive con la regla 2 (un primario) y con ADR-0029 (sin logos dibujados).
- **Enlaces.** Todo enlace a un dato original dice *"View on Strava"*, en negrita, subrayado o naranja.
  La Política §2.4 pide además *"clear links for users to navigate to their Strava accounts"*.
- **Nombre.** Strava no va en el nombre ni en el icono, ni más grande que el texto que lo rodea (§4.1).
- **Tiendas.** La 4.8 de Apple no aplica: Strava no inicia sesión en la cuenta principal
  ([guías](https://developer.apple.com/app-store/review/guidelines/)). La 5.1.2 pide permiso explícito
  antes de compartir datos personales; la 5.1.3 prohíbe usar datos de fitness para publicidad. Si el
  servidor nunca ve actividades, App Privacy y Data safety solo suman el `athlete_id` como identificador
  vinculado; *Fitness info* ya está declarado para los días del círculo.

## 7. Qué haría falta en Vesper

**Diseño mínimo, si se hace.** El teléfono guarda el refresh token en su llavero y le habla a Strava
directo; el servidor nunca ve una actividad.

1. `POST /strava/token`: recibe el código o el refresh token, agrega el secreto, llama a Strava y
   devuelve la respuesta. No guarda nada.
2. `POST /strava/revoke`: igual, para desconectar.
3. Webhook (`GET` y `POST /strava/webhook`): guarda solo `athlete_id ↔ identidad`. Ante una actividad
   nueva o borrada manda un push silencioso; ante una revocación borra el vínculo y las marcas de Strava
   del círculo.
4. En el teléfono, `platform/strava.ts` con `status().reason`: lee la semana con `after`, respeta el
   `429`, mapea `sport_type` y escribe marcas con un `MarkSource` nuevo, `'strava'` (migración).

Que el servidor guarde los tokens y lea por su cuenta le daría todo el historial de cada persona. No.

**Regla 7.** La regla enumera lo que sale del teléfono. Con Strava se suman dos cosas: el código y cada
refresh token pasan por el servidor (sin guardarse), y con webhooks el servidor guarda el `athlete_id`
junto a la identidad. Hace falta un ADR que enmiende la regla 7. `web/privacy.html` debe nombrar a
Strava como responsable independiente (Acuerdo §14.6), decir qué se lee, que las lecturas no salen del
teléfono, cómo desconectar y que el borrado se confirma, más los textos de §5; y cambian
`docs/APP_REVIEW.md` y `docs/PLAY_DECLARATIONS.md`.

**Una sola vez.** Una cuenta de Strava con suscripción, la app en `strava.com/settings/api` con el
*callback domain*, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` y `STRAVA_VERIFY_TOKEN` en Railway (por
`--stdin`), la suscripción del webhook y el formulario de revisión con capturas.

**Esfuerzo** (días de una persona que conoce el repo, con tests, i18n, STATUS y ADR):

| Pieza | Días |
|---|---|
| Cuenta, suscripción, app de Strava, recursos de marca, ADR | 1,5 |
| Servidor: canje, refresco, revocación, webhook, tabla del vínculo, push silencioso, tests | 3–4 |
| Cliente: OAuth app a app y web, `state`, llavero, lectura de la semana, límites | 3–4 |
| Dominio: tipos, piso de 10 min, `manual` a declarado, fuente nueva, borrar al desconectar, tests | 2–3 |
| UI: Ajustes › Strava, consentimiento, desconectar y confirmar el borrado, fuente en el hábito, "View on Strava" | 3–4 |
| Textos legales y de tiendas | 1–2 |
| Verificación en iOS y Android, con y sin la app de Strava, y capturas | 2 |
| **Total** | **16–21**, más una espera de revisión sin plazo |

**Mantenimiento.** La suscripción mensual. La migración obligatoria del 1 de junio de 2027 (URL base
nueva y tokens en cabeceras; el [changelog](https://developers.strava.com/docs/changelog/) dice
`api-v3.strava.com` y el anuncio `www.api-v3.strava.com`, sin confirmar cuál). Vigilar el cupo. Leer cada
cambio de términos: en 2024 y en 2026 los cambios dejaron fuera a apps enteras.

| Riesgo | Qué pasa |
|---|---|
| Strava niega el caso del círculo | La integración sirve solo para hábitos personales |
| La revisión no llega | Nadie más allá de 10 personas puede conectarse |
| La §5.4 se lee al pie de la letra | Un hábito no puede sumar días de Strava y de Salud |
| Borrado en 48 h con el teléfono sin red | El webhook llega, el teléfono no; la marca sigue en el círculo |
| Strava cambia o cobra la API | Apagar la fuente y borrar lo derivado (Acuerdo §4.4) |

**La alternativa que ya está a mano.** `health.ios.ts` recibe `activityName` en cada entrenamiento y lo
descarta; el módulo de Android lee `ExerciseSessionRecord`, que trae `exerciseType`
(`EXERCISE_TYPE_BIKING`, `EXERCISE_TYPE_BIKING_STATIONARY`,
[docs](https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/ExerciseSessionRecord)),
y también lo descarta. HealthKit tiene `cycling` y `handCycling`
([docs](https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype)). Strava escribe en
Salud *"route information, activity type, distance, time, and calories"*; su nota de que la ruta de lo
grabado con Garmin o Zwift no pasa sugiere que el resto sí (sin confirmar)
([ayuda](https://support.strava.com/hc/en-us/articles/216917527-Health-App-and-Strava)).
En Android envía a Health Connect *"time, distance, and calorie data from GPS-based activities"*
([ayuda](https://support.strava.com/en-us/articles/15401554-health-connect-and-strava)); si lleva el tipo
está sin confirmar, y lo que se hace en interiores quedaría fuera. Garmin escribe entrenamientos en Health
Connect desde junio de 2025 ([the5krunner](https://the5krunner.com/2025/05/22/garmin-connect-and-strava-runna-new-link-to-goolge-health-connect/)).
Guardar el tipo, agregar al hábito un filtro ("cualquier ejercicio", "bicicleta", "correr", "caminar")
con su migración y mostrarlo cuesta **de 3 a 5 días**, sin servidor ni términos nuevos, y el círculo
puede ver esos días como ya ve los de pasos (ADR-0042).

## 8. Veredicto

**Ahora no.** El caso que pide el dueño es un reto, y un reto se ve en el círculo. La Política §2.3 lo
prohíbe para datos de Strava, y la única lectura que lo permitiría (§6.1 y §5.13) es ambigua. Construir 16
a 21 días de servidor, OAuth y textos para quedar en 10 personas y a la espera de una revisión sin plazo
no compensa.

**Primero, el tipo de entrenamiento desde Salud y Health Connect** (3 a 5 días, con su ADR). Cubre a quien
graba con Strava en iPhone con "Send to Health" encendido, con Apple Watch, con Garmin y con la mayoría de
relojes. Antes de escribirlo, conviene grabar una rodada en la app de Strava de Android y mirar en Health
Connect si llega con su tipo.

**Strava directo, más adelante**, si se cumplen las cuatro:

1. Strava responde por escrito, a developers@strava.com, que un día marcado se puede mostrar a hasta 12
   personas invitadas con consentimiento expreso, y que ese día puede sumarse con otros de Salud. Si dice
   que no, Strava solo alimenta hábitos personales y nunca un reto, y eso se dice en pantalla.
2. Hay personas reales, no hipotéticas, cuyas actividades no llegan a Salud.
3. Un ADR enmienda la regla 7 con el diseño mínimo de §7: el servidor agrega el secreto y guarda solo el
   vínculo, nunca una actividad.
4. Se acepta pagar la suscripción mientras dure y lanzar solo cuando la revisión haya subido la capacidad.

**Nunca**, si la única razón es el reto con el círculo y Strava dice que no.

## Fuentes

Leídas el 2026-09-29.

- Autorización: https://developers.strava.com/docs/authentication/
- Referencia (actividades, `SportType`, `SummaryActivity`): https://developers.strava.com/docs/reference/
- Paginación y fechas: https://developers.strava.com/docs/
- Límites, capacidad y revisión: https://developers.strava.com/docs/rate-limits/
- Primeros pasos: https://developers.strava.com/docs/getting-started/
- Webhooks: https://developers.strava.com/docs/webhooks/ · Changelog: https://developers.strava.com/docs/changelog/
- Guía de marca (revisada el 2025-09-29): https://developers.strava.com/guidelines/
- Acuerdo de la API (2026-06-01): https://www.strava.com/legal/api
- Política de la API (2026-06-01): https://www.strava.com/legal/api_policy
- Anuncio del 2026-06-01: https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428
- FAQ de la API: https://communityhub.strava.com/developers-knowledge-base-14/strava-api-faq-12906
- Foro, espera de la revisión: https://communityhub.strava.com/developers-api-7/new-strava-api-update-what-the-message-means-13433
- Foro, suscripción del desarrollador: https://communityhub.strava.com/developers-api-7/regarding-the-issue-of-api-subscription-for-use-13587
- Cambios de noviembre de 2024: https://press.strava.com/articles/updates-to-stravas-api-agreement
- Precios: https://www.strava.com/pricing
- Group Challenges: https://support.strava.com/en-us/articles/15401736-how-do-group-challenges-work-on-strava
- Salud: https://support.strava.com/hc/en-us/articles/216917527-Health-App-and-Strava
- Health Connect: https://support.strava.com/en-us/articles/15401554-health-connect-and-strava
- DC Rainmaker, 2024: https://www.dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html
- Terra, 2026: https://tryterra.co/blog/strava-api-changes-2026
- PKCE no soportado (reporte): https://github.com/openzigs/onyourleft/issues/462
- Garmin y Health Connect: https://the5krunner.com/2025/05/22/garmin-connect-and-strava-runna-new-link-to-goolge-health-connect/
- Apple, guías de revisión: https://developer.apple.com/app-store/review/guidelines/
- `HKWorkoutActivityType`: https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype
- `ExerciseSessionRecord`: https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/ExerciseSessionRecord
