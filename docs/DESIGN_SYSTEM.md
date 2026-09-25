# Sistema de diseño — Vesper

Desde ADR-0016 la referencia es **Brick** (iOS). Tarjetas claras de radio grande sobre un
gris cálido, un botón pastilla oscuro, listas con chevron, toggles en tinta, pestañas de
solo texto. Durante la sesión activa el tema se invierte a oscuro; la pausa vuelve a claro.

El sistema vive entero en `src/design/`: `tokens.ts` (valores), `theme.tsx` (esquema
activo, `useTheme`, `useStyles`, `ForcedTheme`), `navigation.ts` (opciones del Stack),
`shieldPalette.ts` (los tokens convertidos para el escudo de iOS), `useReduceMotion.ts`,
`chrome` (las palabras del cromo —volver, cerrar, cancelar— que el layout raíz entrega
una vez para que ningún componente importe el diccionario), `components/` y
`components/index.ts` (lo único que una pantalla puede importar). Los valores exactos
están en `tokens.ts`; este documento explica los roles.

## Principio

> Una pantalla no conoce un color ni un número. Conoce componentes.

Si una pantalla necesita un `View` con estilo, falta un componente.

## Color

Dos esquemas con la misma paleta de roles. Nunca negro ni blanco puros.

| Rol | Claro | Oscuro | Para qué |
|---|---|---|---|
| `bg` | `#E8E6E2` | `#191919` | fondo de página |
| `bgElevated` | `#EEECE8` | `#202020` | barra de pestañas, hojas |
| `card` | `#F8F7F5` | `#262626` | tarjetas |
| `cardMuted` | `#E3E1DC` | `#303030` | tarjeta dentro de tarjeta, chips, segmento inactivo |
| `ink` | `#1C1B1A` | `#F2F1EE` | texto principal y botón primario |
| `inkSecondary` | `#66645F` | `#A9A7A2` | texto secundario |
| `inkTertiary` | `#A6A39E` | `#6F6D69` | solo placeholders y pistas (~2:1 sobre la página), nunca texto que informa |
| `line` | `#DCD9D3` | `#343434` | separadores |
| `onInk` | `#F8F7F5` | `#191919` | texto sobre `ink` |
| `onInkSecondary` | `#A9A7A2` | `#66645F` | texto secundario sobre `ink`: la segunda línea de una tarjeta de tinta |
| `trackOff` | `#C9C6C0` | `#4A4947` | el riel de un `Toggle` apagado, un paso más oscuro que `line` para que se lea sobre una tarjeta |
| `accent` | `#2F7BF6` | `#3B84F5` | El único color saturado. Hoy solo el cursor de dos campos y el punto de "hoy": los toggles van en tinta |
| `success` | `#3B7A4A` | `#5FA46F` | el check del modo activo |
| `danger` | `#C0392B` | `#E06B5E` | acciones destructivas |
| `shadow` | tinta | negro | color de las sombras de tarjeta y del objeto |
| `scrim` | tinta al 45 % | fondo al 60 % | la página atenuada detrás de una hoja |

**Superficie.** Un control con relleno "apagado" (`Chip`, `DayPicker`, el riel de
`SegmentedControl`, `Button size="sm" variant="secondary"`) toma su relleno de lo que
tiene debajo, para no desaparecer: `card` sobre la página, `cardMuted` sobre una
tarjeta, `card` otra vez sobre una tarjeta `muted`. `Card` (y con ella `ListGroup`,
`FieldRow`, `StatCard`, `ScheduleCard`) lo provee por contexto (`src/design/surface.tsx`);
el prop `surface` solo sirve para forzarlo.

El esquema lo decide `useSchemeStore`: `light` en la app, `dark` mientras hay sesión
(lo cambia el store de foco al empezar, pausar, reanudar y terminar). `ThemeScope`
fija un esquema para un subárbol (bienvenida y tour del onboarding son oscuros) y es
la única vía de una pantalla a `ForcedTheme`. `QrCode` ignora el esquema a propósito:
una cámara quiere módulos oscuros sobre claro.

El escudo de iOS no renderiza en React: `shieldPalette.ts` convierte los tokens
(fondo `light.ink`, texto `dark.ink`, botón `light.onInk`) a los canales 0–255 que la
extensión espera, y `modules/vesper-blocking/.../colors.xml` copia los mismos valores
para el escudo de Android. Si cambia un token, cambian los tres sitios.

## Tipografía

Outfit, tres pesos: 400, 500, 600. Se direcciona por familia por peso
(`Outfit_400Regular`, etc.).

| Variante | Tamaño / interlínea | Uso |
|---|---|---|
| `hero` | 44 / 50 | el tiempo de la sesión, la cifra grande |
| `title` | 30 / 36 | títulos de onboarding y de página |
| `heading` | 22 / 28 | nombre del modo, títulos de sección |
| `body` | 16 / 22 | texto |
| `label` | 14 / 20 | secundario, filas |
| `caption` | 12 / 16 | pistas, pies |

Todo el texto pasa por `Text` con `variant`, `tone` y `weight`. Sin mayúsculas
completas salvo `VESPER` (`t.common.brand`), las etiquetas de `StatCard` y la píldora del
promedio de `BarChart`; `PeriodStrip` pone en mayúsculas sus propias opciones (con el
`locale`), así que el diccionario las escribe en oración.

- `tone="tertiary"` es solo para placeholders y pistas de cómo tocar algo ("Toca el
  número para verlo en días"). Todo lo que informa —un límite, una promesa de
  privacidad, un estado, una razón— va en `secondary`.
- `variant="title"` es un encabezado para VoiceOver por defecto, igual que el título de
  `PageHeader`, `Section`, `ListGroup` y `Sheet`: el rotor de encabezados funciona.
- `live` en un `Text` que cambia solo y cuyo cambio importa (la fase de la respiración,
  un resultado): región viva en Android, anuncio en iOS.

## Espaciado, forma, sombra, movimiento

- `space`: 4, 8, 12, 16, 20, 24, 32.
- `radius`: 10, 14, 20, 28, pastilla.
- `layout`: margen de página 20, objetivo táctil 44, barra de pestañas 56, iconos
  16/20/24 (18 en filas), objeto central 132, icono de app 24/40/56, QR 168; también las
  medidas de `BarChart` (`layout.chart`), `DotGrid` (`layout.dotGrid`), el círculo de
  `DayPicker` (40, con área táctil de 44), el indicador de pestañas y el tope de alto de
  `Sheet` (85 % de la ventana). Ningún componente escribe un número de tamaño propio.
- **Objetivo táctil.** Todo lo tocable llega a 44 pt: `Tappable` mide a sus hijos y
  extiende el área con `hitSlop` sin mover nada; los glifos sueltos (la x de `Banner`
  y de `SearchField`) y los círculos de `DayPicker` hacen lo mismo.
- `shadow.card` suave y ancha; `shadow.hero` para el objeto central. En Android, `elevation`.
- `motion`: fade de 160 ms entre rutas, 900 ms de mantener el botón, 520 ms de
  inundación. Sin springs, sin rebote de scroll, y nada se desliza. Lo único que se anima
  es la opacidad:
  - La barra de la pestaña activa no viaja de una palabra a otra: la de la pestaña que
    se deja se apaga y la de la nueva se enciende, en los mismos 160 ms del fade de ruta;
    con "Reducir movimiento" cambia sin transición.
  - La grilla de días (`HeatGrid`) se enciende cuadro a cuadro al aparecer, al azar y a
    distinto ritmo; el de hoy respira lento (hasta 40 % y vuelve).
  - Entrar en sesión es una **disolución punteada**, el mismo lenguaje del arte de foco
    (ADR-0018): `HoldButton` llena la pastilla de puntos de papel desde los extremos
    hacia el centro mientras se mantiene, e `InkFlood` inunda la página de tinta desde
    el botón antes de que abra la ruta oscura. Los puntos salen de `src/lib/dissolve.ts`
    agrupados en capas (`motion.dissolve`), una opacidad por capa con el driver nativo.
  - Salir es la misma disolución al revés, papel sobre tinta, con `tone="paper"`; la
    pausa entra con papel y vuelve con tinta (ADR-0025).
  - `BreathingObject` enciende sus 16 celdas de abajo hacia arriba al inhalar y las
    apaga de arriba hacia abajo al exhalar, solo con el dedo puesto.
  - `FlipDigit` cae en dos mitades en 340 ms, lineal, sin rebote.
  - Con "Reducir movimiento" activo (`useReduceMotion`) la grilla y la respiración
    saltan a su estado final.

## Componentes

Lo que exporta `src/design/components/index.ts` (59 componentes y el hook `useTooltip`). `HeatSquare` (una celda de `HeatGrid`) y `FlipDigit` (una carta de `FlipClock`)
existen pero no se exportan: son internos.

| Componente | Qué es |
|---|---|
| `Screen` | Fondo, safe area, márgenes, scroll opcional, `footer` pinneado, `inTabs`; `avoidKeyboard` sube contenido y pie sobre el teclado; `scrollResetKey` vuelve arriba al cambiar |
| `Stack`, `Section`, `SectionTitle`, `Spacer`, `Divider`, `Columns` | Layout: gaps, título + contenido (un solo estilo de título, encabezado para VoiceOver), empuje, hairline, columnas iguales |
| `Text` | Todo el texto: `variant` × `tone` (incluye `onInkSecondary`) × `weight`; `live`, `selectable` |
| `PageHeader` | `onBack` (chevron) en toda ruta empujada; `onClose` (x) solo en una ruta que entra desde fuera (`circle/join`). Título centrado de hasta dos líneas, acción derecha, o `progress` (puntos) cuando no hay título |
| `DropdownTitle` | Texto centrado con chevron que abre un selector: título de Actividad (`size="body"`), el modo en Focus (`heading`), la duración (`label`, `tone="secondary"`) |
| `PeriodStrip` | Fila de opciones pequeñas bajo un título ('SEMANA PASADA · ESTA SEMANA'); las pone en mayúsculas ella misma |
| `TabBar` | Cuatro pestañas de texto con una barra de tinta bajo la activa |
| `Button` | Pastilla: `primary` (tinta), `secondary` (tarjeta), `ghost` (texto). `tone="danger"` para lo que borra, sale o archiva; `size="sm"` es la pastilla de acción de una fila o tarjeta (Aceptar, Dar ánimo) |
| `HoldButton` | La pastilla que se mantiene: se llena de puntos de papel y dispara `onHold`; `tapHint` responde a un toque corto; la acción de accesibilidad `activate` arranca igual |
| `IconCircle`, `Icon` | Botón redondo con icono Feather; icono suelto |
| `Card` | Superficie: `default`, `muted`, `ink`. `chevron` en una tarjeta que abre algo, `selected`, y `actions`: controles de la tarjeta que quedan fuera de su área tocable, para que VoiceOver llegue a cada uno |
| `NoticeCard` | Una tarjeta que dice una cosa: no disponible, denegado, ya no está, lleno, una advertencia o un empujón hacia algo. Título, cuerpo, icono, `trailing` (chevron o badge) y como mucho una salida: la tarjeta entera o una pastilla de acción |
| `ChoiceCard` | Una opción de una elección corta, como tarjeta con radio: profundidad del modo, cómo se cuenta un hábito, el objetivo del primer modo |
| `StatusNote` | La línea pequeña que explica: la razón de `status()`, el resultado de una acción (`tone="danger"` si falló), la nota de datos de ejemplo; `kind="empty"` para "todavía no hay nada" dentro de una sección. Va justo debajo de lo que explica |
| `ListGroup`, `ListRow` | Tarjeta de filas con hairline y `footer` opcional; fila con icono, valor (se encoge antes que la etiqueta), control o chevron. `selection="radio" \| "checkbox"` + `selected` dibuja el `Check` y dice el estado; `expanded` para acordeones; `disabled`, `onLongPress`, acciones de accesibilidad |
| `AppRow` | Una `ListRow` encabezada por un `AppTile`: selectores de apps (`selection` + `selected`), desglose de uso (con `value` a la derecha). `subordinate` la vuelve hija de la fila de arriba: tile de `sm` alineado a la columna de iconos y nombre y valor un escalón abajo, para que el desglose de ADR-0029 no pese más que la fila de la que cuelga |
| `ScheduleCard` | Tarjeta de rutina: título, líneas de estado, `warning`, y a la derecha `control`: interruptor, arranque o chevron. `preview` la dibuja quieta, con un `badge` donde iría el interruptor |
| `Toggle` | Switch nativo, riel en `ink`, apagado en `trackOff`; `disabled`, `accessibilityHint` |
| `SegmentedControl` | Dos o tres pastillas, la elegida en tinta; un grupo de radios para VoiceOver |
| `Check` | Radio o checkbox, `ink` o `success`; sin marcar, borde `inkSecondary` (3:1) |
| `Chip`, `ChipGroup`, `Badge` | Pastilla de opción (`disabled`, `surface`); una elección entre varias pastillas como grupo de radios; pastilla apagada con una etiqueta corta. Un `Chip` es una opción, nunca una acción: para eso, `Button size="sm"` |
| `FieldRow` | "Nombre …… valor" con input a la derecha; `multiline` pone la etiqueta arriba; `autoCorrect`, `spellCheck`, `returnKeyType`, `decimal-pad`, `characters` |
| `SearchField` | Buscador en pastilla con cancelar |
| `DayPicker` | Siete círculos, lunes a domingo, casillas para VoiceOver |
| `Sheet` | Hoja inferior con título y cerrar, sobre el `scrim`; hasta el 85 % de la ventana, y lo que no cabe se desplaza. Con un campo, sube sobre el teclado en las dos plataformas (un modal de Android de borde a borde no se redimensiona solo) |
| `Banner`, `Tooltip`, `useTooltip` | Aviso oscuro arriba; burbuja que explica un no (`overlay` flota sin empujar la lista); el hook que la muestra, la anuncia en iOS y la quita |
| `ExplainerBlock` | Icono en círculo, encabezado y párrafo: las páginas de permiso apilan tres |
| `ProgressDots`, `ProgressBar` | Puntos del onboarding; barra fina, con segmentos. Las dos son barras de progreso para VoiceOver, con valor |
| `Dot` | El punto pequeño de "hoy" junto a una leyenda |
| `AppTile`, `AppIconStack`, `Avatar` | Cómo se ve una app (ADR-0029): el icono real si la plataforma lo da (Android), si no un tile con letra y color del catálogo, o apagado sin color; pila "+N"; iniciales de una persona |
| `HeroObject` | El objeto central: tile con la grilla de semanas |
| `BreathingObject` | El tile que respira con el dedo (ADR-0025) |
| `BootReveal` | El arranque: la tinta del splash se disuelve de los bordes al centro hasta dejar la marca, que se funde con la app (ADR-0028) |
| `HeatGrid` | La grilla de los últimos días en Focus, cuatro niveles, se enciende al aparecer |
| `FlipClock` | Reloj split-flap de la sesión; `scale` para el modo horizontal |
| `StippleCanvas` | El lienzo del arte de foco: los primeros N puntos como un path SVG |
| `InkFlood` | La inundación punteada desde un origen: `ink` para entrar, `paper` para salir |
| `QrCode` | Un QR como path SVG, siempre en paleta clara |
| `StatCard` | Etiqueta, cifra grande, frase |
| `BarChart`, `HorizontalBars`, `DotGrid` | Barras verticales con guías y promedio (una guía que queda bajo la pastilla del promedio conserva la línea y pierde la etiqueta); barras horizontales; grilla de cuadros (la densa, miles de celdas, como dos paths SVG, centrada) |
| `ThemeScope` | Un subárbol en un esquema fijo, con la barra de estado que le corresponde |
| `NativeHost` | Caja apagada de alto fijo para una vista nativa (el selector de Screen Time) |
| `FatalError` | La única pantalla que existe porque algo se rompió; el único texto fuera de `i18n` |

### Qué se usa para qué

- **Destructivo**: `Button variant="ghost" tone="danger"` en el pie, o `ListRow tone="danger"`
  en una lista, siempre con confirmación (`Alert` con estilo `destructive`).
- **Estados**: `NoticeCard` cuando la página entera no está disponible o hay una sola
  cosa que decir; `StatusNote` para la línea bajo un control; `StatusNote kind="empty"`
  para una lista vacía dentro de su sección.
- **Elegir uno**: `ListRow selection="radio"` en listas y hojas, `ChoiceCard` cuando cada
  opción necesita una frase, `ChipGroup` para cifras cortas.
- **Interruptores**: `ListRow` con `Toggle` dentro de un `ListGroup`, con la descripción
  en la fila y el pie del grupo en `footer`.

## Cómo se escribe una pantalla

Ver `docs/PROTOTYPE_GUIDE.md`. Resumen: importa de `src/design/components`, `src/data` y
`src/lib`/`src/domain`; un botón primario en el `footer`; todo texto desde `useStrings()`,
en español neutro de tú y en inglés con la misma voz (ADR-0020).
