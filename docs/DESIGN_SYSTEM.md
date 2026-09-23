# Sistema de diseño — Vesper

Desde ADR-0016 la referencia es **Brick** (iOS). Tarjetas claras de radio grande sobre un
gris cálido, un botón pastilla oscuro, listas con chevron, toggles azules, pestañas de
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
| `accent` | `#2F7BF6` | `#3B84F5` | toggles. El único color saturado |
| `success` | `#3B7A4A` | `#5FA46F` | el check del modo activo |
| `danger` | `#C0392B` | `#E06B5E` | acciones destructivas |
| `shadow` | tinta | negro | color de las sombras de tarjeta y del objeto |
| `scrim` | tinta al 45 % | fondo al 60 % | la página atenuada detrás de una hoja |

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
completas salvo `VESPER` y las etiquetas de `StatCard` y `PeriodStrip`.

## Espaciado, forma, sombra, movimiento

- `space`: 4, 8, 12, 16, 20, 24, 32.
- `radius`: 10, 14, 20, 28, pastilla.
- `layout`: margen de página 20, objetivo táctil 44, barra de pestañas 56, iconos
  16/20/24 (18 en filas), objeto central 132, icono de app 24/40/56, QR 168.
- `shadow.card` suave y ancha; `shadow.hero` para el objeto central. En Android, `elevation`.
- `motion`: fade de 160 ms entre rutas, 220 ms para lo que se desliza a su sitio,
  900 ms de mantener el botón, 520 ms de inundación. Sin springs, sin rebote de scroll.
  Lo único que se anima es la opacidad:
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

Lo que exporta `src/design/components/index.ts` (54 hoy, con `KeyPattern` del ADR-0034). `AppImage` (icono real de
Android), `HeatSquare` (una celda de `HeatGrid`) y `FlipDigit` (una carta de `FlipClock`)
existen pero no se exportan: son internos.

| Componente | Qué es |
|---|---|
| `Screen` | Fondo, safe area, márgenes, scroll opcional, `footer` pinneado, `inTabs`, `flush` |
| `Stack`, `Section`, `Spacer`, `Divider`, `Columns` | Layout: gaps, título + contenido, empuje, hairline, columnas iguales |
| `Text` | Todo el texto: `variant` × `tone` × `weight` |
| `PageHeader` | Back o cerrar, título centrado, acción derecha |
| `DropdownTitle` | Título centrado con chevron que abre un selector de vista (Actividad) |
| `PeriodStrip` | Fila de opciones pequeñas bajo un título ('SEMANA PASADA · ESTA SEMANA') |
| `TabBar` | Cuatro pestañas de texto con punto |
| `Button` | Pastilla: `primary` (tinta), `secondary` (tarjeta), `ghost` (texto) |
| `HoldButton` | La pastilla que se mantiene: se llena de puntos de papel y dispara `onHold` |
| `IconCircle`, `Icon` | Botón redondo con icono Feather; icono suelto |
| `Card` | Superficie: `default`, `muted`, `ink` |
| `ListGroup`, `ListRow` | Tarjeta de filas con hairline; fila con icono, valor, control o chevron |
| `AppRow` | Una `ListRow` encabezada por un `AppIcon`: selectores de apps, lista de uso |
| `ScheduleCard` | Tarjeta de rutina: título, líneas de estado, toggle o botón de arranque |
| `Toggle` | Switch nativo en `accent` |
| `SegmentedControl` | Dos o tres pastillas, la elegida en tinta |
| `Check` | Radio o checkbox, `ink` o `success` |
| `Chip`, `Badge` | Pastilla de opción; pastilla apagada con una etiqueta corta |
| `FieldRow` | "Nombre …… valor" con input a la derecha |
| `SearchField` | Buscador en pastilla con cancelar |
| `DayPicker` | Siete círculos, lunes a domingo |
| `Sheet` | Hoja inferior con título y cerrar, sobre el `scrim` |
| `Banner`, `Tooltip` | Aviso oscuro arriba; burbuja que explica un no |
| `ExplainerBlock` | Icono en círculo, encabezado y párrafo: las páginas de permiso apilan tres |
| `ProgressDots`, `ProgressBar` | Puntos del onboarding; barra fina, con segmentos |
| `AppIcon`, `AppIconStack`, `Avatar` | Tile con letra que hace de icono de app; pila "+N"; iniciales de una persona |
| `HeroObject` | El objeto central: tile con la grilla de semanas |
| `BreathingObject` | El tile que respira con el dedo (ADR-0025) |
| `BootReveal` | El arranque: la tinta del splash se disuelve de los bordes al centro hasta dejar la marca, que se funde con la app (ADR-0028) |
| `HeatGrid` | La grilla de los últimos días en Focus, cuatro niveles, se enciende al aparecer |
| `FlipClock` | Reloj split-flap de la sesión; `scale` para el modo horizontal |
| `StippleCanvas` | El lienzo del arte de foco: los primeros N puntos como un path SVG |
| `InkFlood` | La inundación punteada desde un origen: `ink` para entrar, `paper` para salir |
| `QrCode` | Un QR como path SVG, siempre en paleta clara |
| `KeyPattern` | El código de la llave (ADR-0034): un QR dibujado como campo de puntos, con las tres esquinas cuadradas para que un lector lo encuentre. Siempre en paleta clara y sin animación: cualquier fotograma es un código entero |
| `StatCard` | Etiqueta, cifra grande, frase |
| `BarChart`, `HorizontalBars`, `DotGrid` | Barras verticales con guías y promedio; barras horizontales; grilla de cuadros |
| `ThemeScope` | Un subárbol en un esquema fijo, con la barra de estado que le corresponde |
| `NativeHost` | Caja apagada de alto fijo para una vista nativa (el selector de Screen Time, la cámara de la llave) |
| `FatalError` | La única pantalla que existe porque algo se rompió; el único texto fuera de `i18n` |

## Cómo se escribe una pantalla

Ver `docs/PROTOTYPE_GUIDE.md`. Resumen: importa de `src/design/components`, `src/data` y
`src/lib`/`src/domain`; un botón primario en el `footer`; todo texto desde `useStrings()`,
en español neutro de tú y en inglés con la misma voz (ADR-0020).
