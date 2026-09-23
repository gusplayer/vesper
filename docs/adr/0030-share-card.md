# ADR-0030 — Compartir un momento: una tarjeta de imagen hecha en el teléfono

**Estado:** propuesta · 2026-09-18 · revisada el mismo día con cuatro revisiones (esencia,
crecimiento, diseño, técnica)

## Contexto

Vesper no tiene ninguna forma de mostrar un logro fuera del teléfono. Lo único que sale
por la hoja del sistema es el texto de la invitación al círculo (`circle/invite`). El
apoyo social existe solo dentro del círculo (ADR-0021): hasta 12 personas, sin feed, sin
ranking, sin notificaciones más que lo que otra persona hizo (ADR-0027).

El dueño del producto pide tres cosas a la vez: que el usuario pueda mostrar sus logros y
su avance en redes (historias y publicaciones), que reciba apoyo de gente fuera del
círculo, y que eso dé a conocer la app. Con dos condiciones: la imagen es de nuestra línea
visual, minimalista, y dice poco y bien.

Lo que ya existe y sirve tal cual:

- **Momentos.** `session/complete` es el único lugar que celebra ("Sesión completa.",
  "Recuperaste tu tiempo."). El cierre de semana ya no es una pantalla (ADR-0026): la
  semana se lee en Actividad › Semanal.
- **Una imagen propia por sesión.** El arte de foco (ADR-0018) es un dibujo puntillista
  que se completa exactamente cuando termina el timer, elegido por semilla del id de la
  sesión. Es único, es nuestro y solo está terminado si la sesión terminó. Ninguna otra
  app tiene esto; ADR-0018 dijo "sin compartir" por alcance, no por producto.
- **Una marca, no un logo.** La grilla 4×4 (nueve celdas en tinta, siete apagadas) es el
  icono de la tienda, el objeto de la portada y la última imagen del arranque (ADR-0028).
- **Sistema de diseño cerrado.** Tokens de dos esquemas, Outfit, componentes a mano. Una
  tarjeta dibujada con ellos se ve como la app sin trabajo extra.

La tensión de fondo: compartir en Instagram desde la app que bloquea Instagram. No es
hipocresía por el contenido, sino por el *cuándo*: `session/complete` llega en el segundo
en que el bloqueo se levanta y la app te está diciendo que sueltes el teléfono. Se resuelve
con tiempo (nada se pierde por compartir después), con palabras (la tarjeta dice lo que
hiciste, nunca lo que evitaste ni contra qué app) y con qué sale (un número, una línea, el
dibujo).

Lo que hay que respetar: regla 2 (un primario por pantalla; compartir nunca lo es), regla 7
(local-first: la imagen se hace en el teléfono), ADR-0004 y ADR-0005 (nada de uso de redes
en la tarjeta), y "Qué NO hacer" de `CLAUDE.md` (sin badges, medallas, puntos, ranking,
emoji ni exclamaciones; fuera de sesión máximo dos avisos al día, y ninguno invita a
compartir).

## Opciones

1. **Nada.** El círculo es el apoyo social. No responde a lo pedido: el círculo es privado
   y pequeño por diseño; compartir hacia afuera es otro gesto, elegido cada vez.
2. **Tarjeta de imagen renderizada en el teléfono y entregada a la hoja del sistema.**
   Un componente `ShareCard` de `design/components` se monta fuera de pantalla, se captura
   a PNG con `react-native-view-shot` y se entrega con `expo-sharing`. El usuario elige
   Instagram, WhatsApp, Fotos o lo que tenga. Dos dependencias nativas, sin red.
3. **Enlace directo a Instagram Stories** (`instagram-stories://share`). Ahorra un toque
   pero ata la app a una red, exige un Facebook App ID, y deja fuera WhatsApp, que en
   nuestro mercado es donde más se comparte y donde el apoyo llega como respuesta. Se descarta.
4. **Imagen renderizada en un servidor.** Contradice local-first y no hay backend. Se descarta.

## Decisión

Opción 2. Se llama **Compartir** (en inglés, *Share*) y obedece seis principios:

1. **Solo momentos cerrados por la app.** Se comparte una sesión completa (cerrada por el
   timer) y, en una segunda tanda, una semana cerrada. Nunca una sesión cancelada, una
   emergencia o una pausa (`closed` "no celebra", ADR-0025). Nunca la racha sola: es un
   número que se mira, no que se anuncia. Nunca un hábito marcado: es declarado, se
   registra, no se celebra (ADR-0005). Nunca las semanas de vida: son opt-in y pesan
   (PRD). Nunca un reto del círculo: sacaría a otras personas.
2. **Un gesto secundario con vista previa.** En `session/complete`, una fila ghost
   "Compartir" bajo la ficha. Abre una `Sheet` con la tarjeta a escala y un solo botón,
   "Compartir", que abre la hoja del sistema. La vista previa es obligatoria: la intención
   es la palabra del usuario y lo que ve es lo que sale. El primario de la pantalla sigue
   siendo Continuar. Nunca un aviso, nunca una hoja que aparezca sola.
3. **Una tarjeta, un formato.** Vertical 9:16 a 1080×1920 físicos, con todo el contenido
   dentro del cuadrado central (y = 420 a 1500) para que el recorte de la red a 4:5 o 1:1
   no pierda nada y las zonas que Instagram tapa arriba y abajo queden vacías. Sin elección
   de formato ni de plantilla.
4. **Dice tres cosas.** Sesión: el dibujo de foco terminado, la duración servida ("52 min")
   y una línea: la intención tal como se escribió, o "Una sesión de foco." si no la hubo,
   o "Primera sesión de foco." si fue la primera. Semana: el objeto de Vesper, las horas de
   foco ("11 h") y "de 10 esta semana" (o solo "esta semana" sin meta). Nada más: ni el
   nombre del modo (lo escribe el usuario y suele nombrar apps), ni cuántas apps, ni uso de
   redes, ni conteo de hábitos, ni nadie del círculo, ni racha, ni acumulados.
5. **En tinta, siempre.** La tarjeta usa el esquema oscuro de la sesión aunque la pantalla
   que la origina sea clara. Es donde el arte de foco existe, es lo que se distingue en un
   carrete de fotos, y ya hay precedente: la ficha titular de Actividad es `StatCard`
   en tinta sobre página clara. Sin degradados (el JPEG de Instagram los bandea), sin el
   azul de acento (en una imagen no hay toggles ni enlaces), solo `ink` e `inkSecondary`
   para texto.
6. **La marca, sin pedir nada.** Abajo, la grilla 4×4 pequeña y "Vesper" en Outfit, en
   una fila, igual que la persona lo verá al buscar en la tienda. Sin URL, sin QR, sin
   "descárgala", sin marca de agua sobre el dibujo. El nombre solo es ambiguo; la marca
   lo desambigua.

### Cómo cierra el bucle

- **Apoyo**: llega por el canal donde ya hablan. En WhatsApp responden al estado o al chat;
  en Instagram, con una reacción o un mensaje. Vesper no necesita saberlo y no lo sabe.
- **Personas nuevas**: quien ve la imagen no puede tocarla (una historia solo enlaza con un
  sticker manual). Llega a la tienda buscando "Vesper" con la marca que vio. Si quiere
  entrar al círculo de quien compartió, teclea el código de seis letras que ya existe en
  `circle/invite`. Es la mecánica mínima honesta sin backend.
- **La invitación no va en la imagen ni en la hoja.** Un código impreso en una historia
  pública convierte al círculo en un lobby de desconocidos, los códigos se regeneran y las
  imágenes no, y la hoja del sistema no empareja imagen y texto de forma fiable (iOS y
  Android toman uno u otro; Instagram descarta el texto). Invitar sigue siendo un acto
  privado y dirigido, en su propia pantalla.

### Lo que la tarjeta nunca hace

- No hay aviso, notificación ni línea en Focus que invite a compartir.
- No es primario, no está en onboarding, ni en `closed`, `exit`, `emergency` ni en pausa.
- No desbloquea nada: ni obras, ni días de gracia, ni desbloqueos de emergencia.
- No cuenta cuántas veces se compartió, ni en local ni en el futuro. No hay analítica.
- No se guarda ni se muestra en una galería dentro de la app: se genera, se entrega, se borra.
- No tiene variantes por red, hashtags ni texto prellenado. El pie lo escribe la persona.
- No muestra "top X %", horas totales del sistema ni nada que compare o sume estimados.
- No adelanta el fin del bloqueo: la fila vive donde la sesión ya terminó.

### Dónde vive en el código

- `src/domain/shareCard.ts` (+ test, en `es` y `en`): puro. `sessionCard(session, dict)`
  y `weekCard(week, dict)` devuelven las líneas; `SHARE_CARD` fija el tamaño y la zona
  segura. Recibe el diccionario por parámetro; el lint le prohíbe React, Expo e i18n.
- `src/design/components/Mark.tsx`: la grilla 4×4, hoy dibujada dos veces (`HeroObject`,
  `BootReveal`). Se extrae y los tres la usan.
- `src/design/components/ShareCard.tsx`: la tarjeta. `ForcedTheme` en tinta, **no**
  `ThemeScope` (ese monta la barra de estado y la pondría en claro sobre la pantalla).
  Tamaño fijo en puntos (`1080 / PixelRatio`), `collapsable={false}`, fondo opaco,
  `allowFontScaling` apagado, y la posición fuera de pantalla resuelta aquí (features no
  usa `StyleSheet`). Recibe los `dots` de la sesión, como `StippleCanvas`.
- `StippleCanvas` gana un prop `size` explícito: hoy mide con `onLayout` y devuelve `null`
  en el primer frame, y una captura fuera de pantalla saldría vacía.
- `src/platform/share.ts`: `status()` (`isAvailableAsync`, y la razón si no),
  `captureCard(ref)` con `captureRef` y `shareImage(uri)` con `mimeType: 'image/png'`.
  Los nativos se cargan con `require` en `try/catch` como el resto de `platform/`;
  `releaseCapture(uri)` al cerrar la hoja. `'share'` entra en `CapabilityName`.
- `src/features/share/ShareSheet.tsx` y `ShareCardCapture.tsx`: la hoja con la vista
  previa y el botón, y el montaje oculto que expone `share()`. Sin `PixelRatio` ni
  `captureRef`: los pide a `platform/share`.
- `src/i18n/es/share.ts` y `src/i18n/en/share.ts`, registrados en ambos `index.ts`.
- Tokens nuevos en `src/design/tokens.ts`: `font.size.display` (68 / 72 de interlínea;
  el `hero` actual da 132 px a 3×, poco para una historia) y `layout.share`.
- `scripts/artPreview.ts` gana una salida `share` que exporta la tarjeta de ejemplo a
  PNG y a JPEG calidad 70 con submuestreo 4:2:0, que es lo que Instagram hace con ella.

### Composición

```
   0 ┌────────────────────────┐  zona que tapa la UI de la red: solo fondo
 420 ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤  empieza el cuadrado 1:1
 444 │     ·  · ·· ·  ·       │
     │    ·:  pagoda  :·      │  arte 576 px, los puntos reales de la sesión
     │   ·····¨¨¨¨¨¨¨·····    │
1080 │        52 min          │  display, ink
1296 │  Escribir el capítulo  │  heading, inkSecondary (o "Una sesión de foco.")
1404 │       ▦ Vesper         │  marca + wordmark, label
1476 ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤  termina el 1:1
1920 └────────────────────────┘
```

La semana: `HeroObject` grande arriba, "11 h" en display, "de 10 esta semana" en heading,
solo el wordmark abajo (el objeto ya trae la marca).

### Copy

| | es | en |
|---|---|---|
| Fila y botón | Compartir | Share |
| Título de la hoja | Compartir | Share |
| Sesión, sin intención | Una sesión de foco. | One focus session. |
| Primera sesión | Primera sesión de foco. | First focus session. |
| Sesión, con intención | la intención tal como se escribió | as written |
| Semana, con meta | de 10 esta semana | of 10 this week |
| Semana, sin meta | esta semana | this week |
| Sin hoja | Este teléfono no tiene con qué compartir. | This phone has nothing to share with. |

Ninguna línea habla en primera persona ni menciona apps, redes o bloqueo.

## Consecuencias

- Dos dependencias nativas: `react-native-view-shot` fijado a 5.1.1 (la 5.1.0 que trae
  SDK 57 falla en bridgeless; aceptar el aviso de `expo-doctor`) y `expo-sharing`. Ambas
  obligan a `pod install` y rebuild del dev client en iOS y Android; ningún config plugin,
  `app.json` no cambia. Costo de bundle: unos 3 MB desempaquetados, casi todo `html2canvas`
  solo para web.
- ADR-0018 se enmienda en una línea: el arte de foco sí se comparte, solo terminado, con
  el mismo presupuesto de puntos y la misma semilla de la sesión. Nunca se resamplea: la
  obra es la que el usuario vio.
- Cero pantallas nuevas y ningún primario nuevo. Regla 2 no se toca.
- El motor de arte ya es nítido a cualquier tamaño (vectorial). A 1080 px el radio queda
  cerca de 4 px físicos, por encima de lo que el JPEG de la red convierte en neblina. Se
  verifica a ojo con las cinco obras a 1.500, 3.000 y 6.000 puntos; el rostro, con relleno
  fino, es el que más sufre.
- Se entrega en dos tandas: primero la sesión completa, y solo tras verificar la captura
  en los dos teléfonos, la semana desde Actividad › Semanal (desde el lunes, para la semana
  que cerró).
- No se mide cuánto se comparte. Lo que se puede aprender sin telemetría vive fuera de la
  app: búsquedas y descargas en App Store Connect y Play Console.
- Riesgo asumido: `captureRef` sobre una vista montada fuera de pantalla no está
  documentado por la librería, solo reportado por usuarios; en Android exige
  `collapsable={false}` y fondo opaco. Si sale vacía, el plan B es montarla bajo el
  contenido con opacidad cero, y el plan C es `toDataURL` de `react-native-svg`. Hasta
  verlo en los dos teléfonos, `STATUS.md` lo marca como sin verificar.
- Riesgo asumido: quien comparte una intención comparte su propia palabra. Se muestra tal
  cual, y la vista previa es lo que le deja decidir.

## Decisiones que quedan fuera de este ADR

- **Un dominio y un enlace universal `https`.** El link del círculo `vesper://…` no es
  tocable en WhatsApp ni en iMessage, y el nombre "Vesper" a secas compite en la tienda.
  Un dominio corto resolvería las dos cosas y permitiría medir descargas con enlaces de
  campaña de App Store Connect sin ningún SDK. Es una compra y una página estática de
  redirección, no un backend, pero es una decisión del dueño del producto y su propio ADR.
  Mientras no exista, la tarjeta no lleva URL.
- **Volver a compartir una sesión más tarde.** Aliviaría la tensión del *cuándo*, pero
  requiere una vista de historia por sesión que la app no tiene (ADR-0015 la dejó
  pendiente). Se retoma si la vista de historia llega.
