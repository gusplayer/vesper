# Fotos en los retos: evidencia entre amigos sin volverse red social

Informe de producto, UX y ética de la atención · 2026-09-26 · sin cambios al repo

## Resumen

Sí se puede, pero con una condición: **la foto se pega a una marca de un reto y a nada
más.** No hay publicación suelta, perfil con fotos, historias, comentarios ni avisos. La
recomendación es el concepto B, "la grilla es el álbum": una foto opcional por persona,
por reto y por día, que ocupa la celda de ese día. Al cierre, la grilla de fotos es la
celebración. Se entrega primero en local (concepto A, sin servidor ni moderación) para
saber si la gente de verdad agrega fotos, y después se comparte con los participantes.

La tensión de fondo que ningún ADR nombra todavía: **una cámara saca el teléfono justo
en el momento que Vesper protege.** Un reto "Sin teléfono en la mesa" con prueba
fotográfica obliga a sacar el teléfono en la mesa. Por eso la foto nunca puede ser la
condición de la marca. Es el recuerdo que se agrega después.

## 0. Qué muestran las referencias (Mobbin)

- **Locket, calendario** ([pantalla](https://mobbin.com/screens/347dd504-99da-4529-a9d9-b5b16e51757b)):
  los días con foto muestran la miniatura; los días sin foto, un punto. Es el concepto B
  casi literal. No se copian el dorado, la racha con fuego ni el contador "6 Lockets".
- **BeReal**: Memorias ordena por calendario, no por novedad
  ([pantalla](https://mobbin.com/screens/78894f3b-8a9e-4a1a-bdeb-d3dd0f74c806)); su hoja
  de reporte dice "tu reporte es confidencial" y trae motivos cortos
  ([pantalla](https://mobbin.com/screens/ead4060b-f806-46a0-a126-5ab930ee3ba4)).
- **Retro** ([pantalla](https://mobbin.com/screens/23e04ae8-f50b-4ea8-bb36-8bb6122e5cae)):
  una fila por semana con el día sobre cada foto. Es la forma del cierre del reto.
- **yope**: el resumen semanal en mosaico ([pantalla](https://mobbin.com/screens/9e44ffc2-0d0c-44c0-ad5d-81c8df0d1dce))
  sirve para el cierre. Su "Drop a pic for the day" con cuenta regresiva y fuego
  ([pantalla](https://mobbin.com/screens/52762633-a84d-4158-a28a-588ae9c4f61f)) es
  exactamente el antipatrón: la escasez fabricada.
- **Hevy, guardar entrenamiento** ([pantalla](https://mobbin.com/screens/c356464b-3fe5-4c5d-9857-a007644d46aa)):
  una casilla punteada con "Agregar foto" dentro del registro. La foto es parte del
  registro, no una publicación. Su pantalla final con confeti y botones de Instagram
  ([pantalla](https://mobbin.com/screens/db9dd20e-1263-4da0-88ef-4fdca528cc6a)) es lo que no queremos.
- **Jomo, "Prove with a photo"** ([pantalla](https://mobbin.com/screens/7b642f18-559f-4272-8017-22f4c1ec037c)):
  una IA "analiza" la foto para dar el hábito por cumplido. Es el antipatrón más claro:
  la foto como condición y la máquina como juez.
- **Strava** ([pantalla](https://mobbin.com/screens/f75e89d7-4088-478c-948b-c2af75795dba)):
  sirve la línea "Solo tú ves: calorías, ritmo" bajo lo que se comparte; no, el contador
  de 171 kudos ([pantalla](https://mobbin.com/screens/fc8edd78-81e8-48c6-a3fe-b24e971627fd)).
- **Instagram, antes del permiso** ([pantalla](https://mobbin.com/screens/be23481d-7280-40aa-88fd-587c926c8771)):
  tres bloques. Es nuestra `PermissionPage` con tres `ExplainerBlock`, tal cual para el
  aviso de la primera foto. (Day One no aparece en Mobbin.)

## 1. Tensiones con lo escrito

| Regla / ADR | Qué toca | ¿Sin enmienda? |
|---|---|---|
| **1** Cuatro pestañas | A y B viven en `circle/challenge` y en una ruta nueva `circle/photo`. C pediría una bandeja de historias. | A, B: sí. C: no |
| **2** Un primario | "Marcar hoy" sigue siendo el primario. La foto es una fila y una celda. La vista previa, que es otra ruta, tiene su propio primario. | Sí |
| **3** Tokens y componentes | Hacen falta componentes nuevos (§2) y `layout.photo` en tokens. De paso: `HeatGrid` hoy fija `CELL = 28` y `SMALL_CELL = 16` en el componente, y al tocarlo pasan a tokens. | Sí (es trabajo, no una excepción) |
| **5** Paleta | Una foto mete color saturado en una app de un solo acento. No rompe la regla (habla del color de la UI), pero choca con la estética: miniatura desaturada en la grilla, color al abrir, siempre dentro de una tarjeta. | Sí |
| **6** Solo opacidad | El visor abre con el fade de 160 ms. Sin carrusel, sin deslizar entre fotos, sin zoom animado. Las historias (barra que avanza sola, deslizar entre personas) la rompen. | A, B: sí. C: no |
| **7** Local-first, sin backend sin ADR | A es todo local. B cabe en "lo que el usuario comparte con su círculo", pero necesita almacenamiento de objetos y rutas nuevas: un ADR que enmiende "qué sale" del ADR-0033 y diga retención y si el servidor ve las fotos. | A: sí. B: ADR |
| **8** Permisos en su flujo | La cámara se pide al tocar "Tomar una foto", con "Ahora no". La galería va por el selector del sistema (PHPicker en iOS, Photo Picker en Android), que no pide permiso. Donde no hay cámara (simulador), lo dice `camera.status().reason`. Capa nueva `platform/camera`. | Sí |
| **9** + ADR-0005 | **Una foto es testimonio, no verificación.** No cambia el `source` de la marca, no cuenta más y no crea una categoría "con prueba". Si la foto contara distinto, la regla se rompería. | Sí, si se respeta |
| **11** Sin feed ni ranking | El álbum no es un feed si está acotado a un reto, va en orden de calendario y nunca junta fotos de varios retos. **Ojo:** la regla *permite* notificar "lo que otra persona hizo", y subir una foto lo es. Hay que escribir en el ADR que las fotos no notifican. | B: sí. C: no |
| **ADR-0027** Presupuesto | A y B no agregan ningún tipo de aviso. C traería "Ana publicó" y avisos de comentarios. | A, B: sí |
| **ADR-0021 §5** Ánimo sin contador | Una reacción por foto es un like. Se reusa el ánimo diario, que es por persona y no por foto. | Sí |
| **ADR-0030** (propuesta) | Prohíbe compartir un reto del círculo y un hábito marcado. El collage personal de A y B lo contradice. Como es propuesta, se revisa sin superarla: "tu álbum de un reto terminado", solo tus fotos, sin nombres ajenos. El álbum del grupo nunca sale. | Revisión de la propuesta |
| **ADR-0032 §4** | Reportar y bloquear estaban previstos para los retos públicos. Las fotos los adelantan: App Store 1.2 pide filtro, reporte, bloqueo y contacto para el contenido de usuarios, y conviene asumir que aplica aunque el grupo sea privado. | B: ADR |
| **ADR-0042** Origen de la marca | Se extiende la idea (cada cosa dice de dónde viene) con el origen de la foto, sin tocar `source`. | Sí |
| **ADR-0048** Respaldo | El respaldo tiene un tope de 5 MB (`MAX_BACKUP_BYTES`) y las fotos no caben. Quedan fuera del respaldo y la pantalla lo dice. | Sí |
| **ADR-0046** y fichas | "Fotos" entra como contenido del usuario en las etiquetas de privacidad y en la política; el cuestionario de edad probablemente cambia. | B: actualizar |

## 2. Tres conceptos

### A. Diario del reto (la foto es tuya)

**Flujo.**
1. En `circle/challenge`, con el día de hoy marcado, aparece la fila "Agregar la foto de hoy".
2. Al tocarla, una `Sheet` "Foto de hoy" con dos filas: "Tomar una foto" y "Elegir de tu galería".
3. Vista previa (`circle/photo-new`): la foto en una tarjeta, un pie opcional, la línea
   "Solo la ves tú." y el primario "Guardar".
4. Tu celda de hoy muestra la miniatura, y tocarla la abre.
5. Al cierre, "Tu álbum" en mosaico y la fila "Compartir tu álbum", que abre la hoja con
   vista previa de ADR-0030 y de ahí la hoja del sistema.

**Dónde vive.** Solo en la pantalla del reto: la fila de un hábito ya tiene su toque
(marca) y su mantener (edita), y no le cabe un tercer gesto.

**Componentes nuevos.** `PhotoTile` (cuadro con imagen, relleno de espera en `cardMuted`,
variante punteada "agregar" y la versión desaturada, quizá con un filtro de
`react-native-svg`: a verificar), `HeatGrid` con `image` por celda y un tamaño `lg` de
36 pt (siete caben en 276 pt), `PhotoCard` (la foto a lo ancho de la tarjeta, con el pie
y los datos debajo) y `PhotoMosaic` (el cierre y la imagen que se comparte). Hacen falta
porque una pantalla no puede darle estilo a un `Image`.

**Qué ve el otro.** Nada. **Qué notifica.** Nada.

**Qué se guarda.** Un archivo en el directorio de la app (no en el carrete) de 1080 px de
lado mayor, JPEG, sin EXIF (sin ubicación), y una fila en `mark_photos` (migración 011:
hábito, `day_key`, uri, origen, pie). Queda fuera del respaldo cifrado y se dice. Dura
hasta que archivas el reto. El cierre ofrece "Guardar tus fotos en tu galería", que en
iOS pide solo el permiso de agregar.

**Riesgos.** De adicción y de privacidad, casi ninguno. El riesgo es de producto: sin
testigos la foto pierde la mitad de su sentido, y lo único que se comparte sale afuera,
hacia Instagram.

```
 circle/photo-new           Cierre (sección)
┌──────────────────────┐   ┌──────────────────────┐
│ ‹     Foto de hoy    │   │ Así terminó          │
│┌────────────────────┐│   │┌────────────────────┐│
││                    ││   ││ Cumpliste las 3    ││
││      [ foto ]      ││   ││ semanas.           ││
││                    ││   │└────────────────────┘│
│└────────────────────┘│   │ Tu álbum             │
│ Pie de foto  ....... │   │┌────────────────────┐│
│ Solo la ves tú.      │   ││ ▒ ▒ · ▒ · ▒ ·      ││
│                      │   ││ ▒ · ▒ ▒ · · ·      ││
│┌────────────────────┐│   ││ · ▒ ▒ · ▒ · ▒      ││
││      Guardar       ││   │└────────────────────┘│
│└────────────────────┘│   │ ↗ Compartir tu álbum │
│      Tomar otra      │   │ ↓ Guardar en galería │
└──────────────────────┘   └──────────────────────┘
```

### B. La grilla es el álbum (recomendado)

**Flujo de quien agrega.**
1. Marca hoy como siempre (o Salud o una sesión lo marcan). La celda de hoy pasa a la
   variante punteada "+" y aparece la fila "Agregar la foto de hoy". Nada se abre solo.
2. **La primera vez**, antes de la hoja, una `PermissionPage` con tres `ExplainerBlock`
   (quién la ve, cuánto dura, qué cuidar), "Entendido" y "Ahora no".
3. `Sheet` con cámara y galería. El permiso de cámara se pide aquí (regla 8); si se
   niega, la fila lo dice y la galería sigue.
4. Vista previa: la foto, el pie (80 caracteres), "La ven Ana y Luis, solo en este reto."
   y el primario "Agregar al reto". Sin red, queda en cola como una marca.
5. La celda muestra la miniatura; se reemplaza o se quita. Solo hoy y ayer.

**Qué ve el otro.** En `StandingsList`, cada semana se dibuja en `lg` y los días con foto
muestran la miniatura desaturada. Tocar una abre `circle/photo?id=`: la foto en una
tarjeta, "Ana · martes 24", el pie, el origen en voz baja ("Con la cámara · 18:40" o "De
la galería"), cómo se contó la marca ("con Salud" o "marcado a mano"), el botón pequeño
"Dar ánimo" (el mismo ánimo diario a Ana, que dice "Enviado" si ya se lo diste) y un
`IconCircle` "…" para reportar, ocultar o bloquear. No se desliza a la siguiente: se
vuelve a la grilla, que es la única navegación. Solo ven fotos quienes se unieron. Quien
fue invitado ve la grilla sin fotos y, encima de "Unirme", la línea "En este reto se
comparten fotos. Las tuyas son opcionales."

**Dónde vive.** `circle/challenge` (la grilla), `circle/photo-new` (vista previa),
`circle/photo` (visor) y la sección de cierre. Nada en Focus, en Actividad ni en
`circle/index`: la `ChallengeCard` sigue siendo texto y puntos.

**Al crear el reto**, una fila con interruptor: "Fotos del día". Los sugeridos traen el
suyo: encendido en "Leer", "Caminar 8.000 pasos" y "Moverte"; apagado en "Sin teléfono en
la mesa" y "Dormir sin pantalla", porque fotografiarlos contradice el reto.

**Componentes nuevos.** Los de A. Lo demás existe: `Sheet`, `ListRow`, `FieldRow`,
`PermissionPage`/`ExplainerBlock`, `IconCircle`, `StatusNote`.

**Qué notifica.** Nada nuevo. Sin punto de "nuevo" en las celdas ni línea en Focus.

**Qué se guarda y cuánto dura.**
- En el teléfono: tus fotos, más las miniaturas de los demás en caché, que se bajan al
  abrir el reto y nunca en segundo plano. La foto completa se baja solo al tocarla.
- En el servidor: `challenge_photos` (id, reto, cuenta, `day_key`, pie, origen) más el
  objeto en un bucket privado (Railway ya ofrece buckets, o R2), con URLs firmadas de vida
  corta, 1080 px y una miniatura de 240 px, sin EXIF.
- Retención: hasta 30 días después de que el reto termina. En un reto sin límite, una
  ventana móvil de 28 días. Tus fotos se van del reto si lo dejas, si te quitan del
  círculo o si borras la cuenta, igual que tus marcas (ADR-0049).
- Idealmente **cifradas de extremo a extremo con una llave por reto**, como el respaldo
  que el servidor no lee. Exige intercambiar llaves entre personas (X25519 o similar);
  hay que verificar si `expo-crypto` 57 lo trae, y si no, es una dependencia y su ADR.
  Cifradas, el reporte manda la foto descifrada desde quien reporta (como WhatsApp). Sin
  cifrar, el aviso dice que quien opera Vesper puede verla.

**El cierre.** "Así terminó" suma "El álbum": una fila por persona con sus fotos en orden
de días (la forma de Retro), sin cuántas tiene cada quien. Debajo, "Compartir tu álbum"
(solo las tuyas), "Guardar tus fotos" y una línea fija: "Las fotos se quedan aquí hasta el
25 de octubre." Es una fecha, no una cuenta regresiva.

**Riesgos.**
- Adicción: volver al reto a ver si hay fotos nuevas. Acotado (una por persona al día,
  doce personas, sin aviso ni punto de "nuevo"), pero hay que vigilarlo (§4).
- Presión por subir foto: marcas idénticas, sin contadores, opcional.
- Comparación de cuerpos en retos de gimnasio: sin reacciones ni conteos se reduce, no
  desaparece.
- Privacidad: caras, casas, niños y capturas que no se pueden impedir. La moderación
  queda en una sola persona, el dueño.

```
 circle/challenge                circle/photo?id=
┌──────────────────────────┐   ┌──────────────────────────┐
│ ‹          Gym           │   │ ‹                    …   │
│ Quedan 12 días           │   │┌────────────────────────┐│
│ 3 veces por semana ·     │   ││                        ││
│ 21 días · con Ana y Luis │   ││        [ foto ]        ││
│                          │   ││                        ││
│  L  M  M  J  V  S  D     │   │└────────────────────────┘│
│ [▒][ ][▒][+][ ][ ][ ]    │   │ Ana · martes 24          │
│        2 de 3            │   │ "Pierna, por fin."       │
│  Te falta 1 · quedan 4   │   │ Con la cámara · 18:40    │
│┌────────────────────────┐│   │ marcado a mano           │
││◻ Agregar la foto de hoy││   │                          │
│└────────────────────────┘│   │ (Dar ánimo)              │
│ Esta semana              │   │                          │
│┌────────────────────────┐│   │                          │
││ Ana        2 de 3   ✓  ││   │                          │
││ con Salud              ││   │                          │
││ [▒][■][ ][▒][ ][ ][ ]  ││   │                          │
││ Luis       1 de 3      ││   │                          │
││ [■][ ][ ][ ][ ][ ][ ]  ││   │                          │
││ (Empujar)              ││   │                          │
│└────────────────────────┘│   │                          │
│┌────────────────────────┐│   │                          │
││     Desmarcar hoy      ││   │                          │
│└────────────────────────┘│   │                          │
│     Salir del reto       │   │                          │
└──────────────────────────┘   └──────────────────────────┘
 ▒ foto desaturada · ■ marca sin foto · + hoy, sin foto

 Cierre del reto
┌──────────────────────────┐
│ Así terminó              │
│┌────────────────────────┐│
││ Cumpliste las 3        ││
││ semanas.               ││
│└────────────────────────┘│
│ El álbum                 │
│┌────────────────────────┐│
││ Tú   ▒ ▒ ▒ ▒ ▒ ▒ ▒ ▒   ││
││ Ana  ▒ ▒ ▒ ▒ ▒         ││
││ Luis ▒ ▒ ▒             ││
│└────────────────────────┘│
│ Las fotos se quedan aquí │
│ hasta el 25 de octubre.  │
│┌────────────────────────┐│
││↗ Compartir tu álbum    ││
││↓ Guardar tus fotos     ││
││⟲ Repetir 21 días       ││
││▢ Archivar el reto      ││
│└────────────────────────┘│
└──────────────────────────┘
```

### C. Historias, reacciones y comentarios (para descartar)

**Qué sería.** Arriba de `circle/index`, una fila de avatares con anillo. Cada persona
publica historias que duran 24 horas, sin atarlas a un reto. Encima se reacciona con
emoji y se comenta.

**Por qué no.**
- La caducidad de 24 horas es el motor del FOMO: hay que mirar antes de que se vaya.
- El anillo de "no visto" es un badge.
- Una reacción con conteo es un like, y ADR-0021 §5 lo prohíbe.
- Los comentarios son hilos, avisos y un canal de acoso con texto que moderar.
- El orden por novedad es un feed (regla 11).
- La barra que avanza sola y el deslizar entre personas rompen la regla 6.
- Los avisos de "publicó" y "comentó" se comen el presupuesto de ADR-0027.
- La publicación suelta, sin promesa detrás, vuelve la app Instagram con otro nombre.

```
 circle/index (lo que no se hace)
┌──────────────────────────┐
│ ‹      Tu círculo     +  │
│ (◉Ana)(◉Luis)(○Sofía)    │ ← anillos "no visto"
│┌────────────────────────┐│
││ [foto] ♥ 12  💬 4       ││ ← conteos = ranking
││ Ana · hace 3 h         ││ ← recencia = feed
│└────────────────────────┘│
└──────────────────────────┘
```

## 3. Decisiones finas

| Pregunta | Recomendación | Por qué |
|---|---|---|
| ¿Obligatoria en un reto "con prueba"? | **No existe el "reto con prueba".** | Saca el teléfono durante la actividad, la galería la vuelve trampa, convierte a los amigos en jueces y choca con lo que Salud marca solo. |
| ¿Una marca sin foto cuenta igual? | **Idéntica.** Ni "3 de 4 (2 con foto)" ni una celda distinta en la tarjeta. | Regla 9: el testimonio no es otra moneda. |
| ¿Cámara o galería? ¿Se dice cuál? | **Las dos.** El origen se dice en voz baja en el visor ("Con la cámara · 18:40", "De la galería"), nunca en la grilla. No se lee el EXIF para acusar. | ADR-0042 (cada cosa dice de dónde viene) con el "espejo, no juez" de ADR-0005. Solo cámara empuja a sacar el teléfono en el momento. |
| ¿Pie de foto? | **Opcional, 80 caracteres.** Sin menciones, sin links tocables, sin hashtags. | Cabe en dos líneas. La intención de la sesión tiene 120, y esto es menos. |
| ¿Reacción? | **No por foto.** En el visor, "Dar ánimo" es el ánimo diario a la persona, y llega como la línea de siempre. | Una reacción por foto es un like con otro nombre. |
| ¿Comentarios? | **No.** | Se habla donde ya se habla (WhatsApp), como dice ADR-0030. |
| ¿Caducidad? | **Con el reto, más 30 días. En un reto sin límite, 28 días móviles.** Sin cuenta regresiva: una fecha fija en el aviso y en el cierre. | Da tiempo de guardar sin crear urgencia. |
| ¿Fotos de alguien fuera del reto? | **No.** No hay "las fotos de Ana". | Sin perfiles (ADR-0021 §1). |
| ¿Fotos en la semana del círculo? | **No.** | La semana son números. Una foto sin promesa es una publicación, y una publicación es el primer ladrillo del feed. |
| ¿Foto al completar una sesión? | **No.** Un reto marcado por sesiones admite la foto después, desde el reto. | La sesión ya tiene su imagen (arte de foco), y `session/complete` es el segundo en que se levanta el bloqueo. |
| ¿Durante una sesión? | **No.** Hoy es imposible por construcción y debe seguir así: ni la Live Activity ni un aviso abren la cámara. | Regla 11, ADR-0027 §1. |
| ¿Días pasados? | **Hoy y ayer.** | Alcanza para el olvido y no para rearmar la semana el domingo por la noche. |
| ¿Una o varias por día? | **Una, reemplazable.** | Acota lo que hay que mirar. |
| ¿Otras personas o menores en la foto? | Aviso antes de la primera foto, un motivo de reporte propio, nada de detección de caras ni etiquetas, y la ubicación borrada. | La Ley 1581 da protección reforzada a los datos de menores. Revisarlo con un abogado antes de publicar. |
| ¿Reportar y bloquear? | En el visor, "…" abre una `Sheet`: "Reportar la foto" (motivos con radio y nota opcional), "Ocultar las fotos de Ana" (solo para ti), "Bloquear a Ana". "Bloquear" también junto a "Quitar" en `circle/invite`. Reportar oculta en el acto, no revela quién fue y llega al dueño con un plazo escrito. | App Store 1.2, ADR-0032 §4. |
| ¿Puede verlas alguien que no se unió? | **Solo quienes se unieron.** Sin frase gancho del tipo "únete para ver". | Reciprocidad a nivel de compromiso, no de cada día como BeReal. |
| ¿Video, Live Photo, filtros? | **No.** Ni edición, ni stickers. | Cada extra es tiempo en la app que no es el reto. |

## 4. Guardarraíles y cómo saber si funcionó

**Guardarraíles (van en el ADR, no en la memoria de nadie):**
1. La foto nunca es condición; una marca sin foto se ve y cuenta igual.
2. Una por persona, reto y día, reemplazable, solo hoy y ayer.
3. Ningún aviso por fotos aunque la regla 11 lo permita; sin punto de "nuevo", nada en
   Focus ni en Actividad.
4. Sin reacciones por foto, sin conteos, sin "visto por", sin comentarios.
5. Orden de calendario; sin scroll infinito, sin juntar retos, sin perfiles con fotos.
6. El visor no desliza: se vuelve a la grilla.
7. Miniaturas desaturadas; la foto siempre dentro de una tarjeta.
8. Ninguna ruta de sesión ni superficie del sistema ofrece la cámara.
9. Sin cuenta regresiva; nada (ni IA) que "verifique" la foto.
10. Nada se descarga en segundo plano.
11. Solo sale del reto lo tuyo; el álbum del grupo no se exporta.
12. Sin video, filtros ni edición; los sugeridos que chocan con una cámara nacen sin fotos.

**Métricas cualitativas (sin telemetría):**
- **El tiempo en pantalla de Vesper del dueño y de su círculo de prueba** (Tiempo de uso
  de iOS o Bienestar digital de Android, que cada quien mira en su teléfono): minutos y
  levantadas por día antes y durante un reto con fotos. Si suben las levantadas y no las
  marcas, algo se torció.
- **Entrevista de cierre de un reto de 21 días** con 5 a 10 amigos, con cinco preguntas:
  ¿Sacaste el teléfono durante la actividad para la foto? ¿Sentiste que tenías que subir
  foto? ¿Abriste el reto solo para ver fotos? ¿Hablaron de alguna foto fuera de la app?
  ¿Qué foto recuerdas?
- **El álbum mismo:** cuántas celdas tienen foto se ve a simple vista en el cierre. Lo
  sano es esporádico. Todas las celdas llenas en todas las personas sugiere obligación
  sentida.
- **¿Se repite el reto?** Comparar el uso de "Repetir" en retos con y sin fotos dentro
  del propio círculo.
- **Reportes:** se espera cero. Uno solo es una señal que se lee entera.
- **El servidor** ya sabe cuántas fotos guarda por reto: si se mira, en agregado y dicho
  en la privacidad.

## 5. Copy

| Pieza | Español | English |
|---|---|---|
| Fila para agregar | Agregar la foto de hoy | Add today's photo |
| Título de la hoja | Foto de hoy | Today's photo |
| Cámara / galería | Tomar una foto · Elegir de tu galería | Take a photo · Choose from your library |
| Campo del pie | Pie de foto · *Una línea, si quieres* | Caption · *One line, if you want* |
| Vista previa (B) | La ven Ana y Luis, solo en este reto. | Ana and Luis see it, only in this challenge. |
| Vista previa (A) | Solo la ves tú. | Only you see it. |
| Primario | Agregar al reto | Add to the challenge |
| Sin red | Se sube cuando haya conexión. | It uploads when you are online. |
| Estado vacío | Todavía no hay fotos. Son opcionales: una marca sin foto cuenta igual. | No photos yet. They are optional: a mark without one counts the same. |
| Origen | Con la cámara · 18:40 · De la galería | With the camera · 6:40 PM · From the library |
| Cámara negada | Vesper no tiene acceso a la cámara. Puedes elegir de tu galería o darlo en Ajustes. | Vesper has no camera access. You can choose from your library or allow it in Settings. |
| Aviso, título | Antes de tu primera foto | Before your first photo |
| Aviso, bloque 1 | **Quién la ve.** Solo quienes están en este reto. No hay perfil ni feed: la foto no sale de ahí. | **Who sees it.** Only the people in this challenge. There is no profile and no feed: the photo stays there. |
| Aviso, bloque 2 | **Cuánto dura.** Se borra del servidor 30 días después de que el reto termina. Puedes quitarla antes. | **How long it stays.** It leaves the server 30 days after the challenge ends. You can remove it sooner. |
| Aviso, bloque 3 | **Qué cuidar.** Si sale otra persona, pregúntale antes. Quitamos la ubicación de la foto. Una captura de pantalla no se puede impedir. | **What to mind.** If someone else is in it, ask them first. We remove the photo's location. A screenshot cannot be prevented. |
| Aviso, botones | Entendido · Ahora no | Got it · Not now |
| Al crear | Fotos del día · Cada quien puede agregar una foto a su marca. Nunca es obligatoria. | Photos of the day · Everyone can add a photo to their mark. It is never required. |
| Encima de "Unirme" | En este reto se comparten fotos. Las tuyas son opcionales. | People share photos in this challenge. Yours are optional. |
| Cierre | El álbum · Las fotos se quedan aquí hasta el 25 de octubre. | The album · The photos stay here until October 25. |
| Cierre, filas | Compartir tu álbum · Guardar tus fotos | Share your album · Save your photos |
| Quitar la tuya | ¿Quitar la foto? Se borra para todos. Tu marca se queda. | Remove the photo? It is deleted for everyone. Your mark stays. |
| Reportar | Reportar la foto · Nadie sabrá que fuiste tú. | Report the photo · Nobody will know it was you. |
| Motivos | No debería estar aquí · Sale alguien sin su permiso · Sale un menor · Otra cosa | It should not be here · Someone is in it without consent · It shows a minor · Something else |
| Tras reportar | Reportada. Ya no la ves, y la revisamos. | Reported. You no longer see it, and we will review it. |
| Ocultar | Ocultar las fotos de Ana · Solo para ti. Sus marcas se siguen viendo. | Hide Ana's photos · Only for you. Their marks still show. |
| Bloquear | ¿Bloquear a Ana? Sale de tu círculo y de tus retos, y no puede volver a pedir entrar. No se le avisa. | Block Ana? They leave your circle and your challenges, and cannot ask to join again. They are not told. |

## 6. Recomendación y fases

**El destino es B, y se llega por A.** B es lo que el dueño pidió: evidencia del
compromiso, compartida con quienes están en la promesa y celebrada al cierre. Mantiene el
diseño (la grilla que ya existe, ahora con fotos), no crea feed y no agrega un solo aviso.
A construye el 80 % de la UI sin servidor ni moderación y contesta la pregunta que
importa antes de gastar en infraestructura: ¿la gente agrega fotos a sus marcas, y lo
hace sin sacar el teléfono en el peor momento? C no se hace, y el ADR debe decir por qué,
para que nadie lo proponga como "la siguiente fase".

**Fase 0 · Decidir (sin código).**
- Un ADR "Fotos en los retos": fija los guardarraíles de §4, enmienda "qué sale" de
  ADR-0033, dice que las fotos no notifican (regla 11), revisa ADR-0030 para "tu álbum",
  adelanta reportar y bloquear (ADR-0032 §4) y elige entre cifrado de extremo a extremo o
  fotos legibles por el servidor con retención corta.
- Justificar dos dependencias: `expo-image-picker` y `expo-image-manipulator` (verificar
  sus APIs en la documentación de SDK 57 antes de escribir código). Si ADR-0030 se
  acepta, `react-native-view-shot` y `expo-sharing` sirven para "Compartir tu álbum".

**Fase 1 · Local (concepto A sobre los retos).**
- `platform/camera` con `status()`, captura, selección y preparación (redimensionar y
  quitar el EXIF).
- Migración 011 `mark_photos`.
- `PhotoTile`, `HeatGrid` con imagen y tamaño `lg`, `PhotoCard` y `PhotoMosaic`, más
  `layout.photo` en tokens.
- La fila, la hoja, la vista previa, el visor propio y el cierre con "Tu álbum".
- Se prueba con el dueño y su círculo en TestFlight durante un reto de 21 días, con la
  entrevista de §4.

**Fase 2 · Compartir con el reto (concepto B).**
- Bucket, `challenge_photos` y las rutas de subida, lectura firmada, borrado, reporte y
  bloqueo en el servidor, más el trabajo de retención.
- El aviso de la primera foto, el interruptor al crear, la línea de consentimiento, la
  hoja "…" y "Bloquear" en `circle/invite`.
- La política de privacidad, las etiquetas de las tiendas y el cuestionario de edad
  (ADR-0046).
- Antes de la tienda: plazo escrito para reportes, el correo de contacto (ADR-0047 §13) y
  la revisión legal sobre menores.

**Fase 3 · Si hace falta.** El cifrado de extremo a extremo (si no entró antes) y, solo
si la entrevista lo pide, una foto privada en hábitos fuera de los retos.

**Nunca:** historias, reacciones por foto, comentarios, avisos por fotos, fotos en la
semana del círculo, perfiles con galería o la foto como condición de una marca.
