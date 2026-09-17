# Sistema de diseño — Vesper

Desde ADR-0016 la referencia es **Brick** (iOS). Tarjetas claras de radio grande sobre un
gris cálido, un botón pastilla oscuro, listas con chevron, toggles azules, pestañas de
solo texto. Durante la sesión activa el tema se invierte a oscuro.

El sistema vive entero en `src/design/`: `tokens.ts` (valores), `theme.tsx` (esquema
activo y `useTheme`), `components/` (32 componentes) y `components/index.ts` (lo único
que una pantalla puede importar).

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
| `inkSecondary` | `#6E6C68` | `#A9A7A2` | texto secundario |
| `inkTertiary` | `#A6A39E` | `#6F6D69` | placeholders, pistas |
| `line` | `#DCD9D3` | `#343434` | separadores |
| `onInk` | `#F8F7F5` | `#191919` | texto sobre `ink` |
| `accent` | `#2F7BF6` | `#3B84F5` | toggles. El único color saturado |
| `success` | `#3B7A4A` | `#5FA46F` | el check del modo activo |
| `danger` | `#C0392B` | `#E06B5E` | acciones destructivas |

El esquema lo decide `useSchemeStore`: `light` en la app, `dark` mientras hay sesión.
`ForcedTheme` fija un esquema para un subárbol (bienvenida y tour son oscuros).

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

Todo el texto pasa por `Text` con `variant` y `tone`. Sin mayúsculas completas salvo
`VESPER` y las etiquetas de `StatCard`.

## Espaciado, forma, sombra

- `space`: 4, 8, 12, 16, 20, 24, 32.
- `radius`: 10, 14, 20, 28, pastilla.
- `layout`: margen de página 20, objetivo táctil 44, objeto central 132, icono de app 24/40/56.
- `shadow.card` suave y ancha; `shadow.hero` para el objeto central. En Android, `elevation`.
- Movimiento: fade de 160 ms entre rutas. Sin springs, sin rebote de scroll. La grilla de
  días (`HeatGrid`) se enciende cuadro a cuadro al aparecer, al azar y a distinto ritmo,
  unos pocos con una duda breve; el de hoy no lleva borde: respira lento y suave (hasta
  40 % y vuelve). Solo opacidad, y con "Reducir movimiento" activo se ve todo encendido
  de una vez.
- Entrar en sesión es una **disolución punteada**, el mismo lenguaje del arte de foco
  (ADR-0018): `HoldButton` llena la pastilla de puntos de papel desde los extremos hacia
  el centro mientras se mantiene (`motion.holdMs`), y `InkFlood` inunda la página de tinta
  desde el botón (`motion.floodMs`, 520 ms) antes de que abra la ruta oscura. Los puntos
  salen de `src/lib/dissolve.ts` agrupados en capas (`motion.dissolve`), una opacidad por
  capa con el driver nativo; nada se escala ni rebota.

## Componentes

| Componente | Qué es |
|---|---|
| `Screen` | Fondo, safe area, márgenes, scroll opcional, `footer` pinneado |
| `Stack`, `Section`, `Spacer`, `Divider` | Layout: gaps, títulos de sección, empuje, hairline |
| `Text` | Todo el texto: `variant` × `tone` × `weight` |
| `PageHeader` | Back o cerrar, título centrado, acción derecha |
| `TabBar` | Cuatro pestañas de texto con punto |
| `Button` | Pastilla: `primary` (tinta), `secondary` (tarjeta), `ghost` (texto) |
| `IconCircle`, `Icon` | Botón redondo con icono Feather; icono suelto |
| `Card` | Superficie: `default`, `muted`, `ink` |
| `ListGroup`, `ListRow` | Tarjeta de filas con hairline; fila con icono, valor, control o chevron |
| `Toggle` | Switch nativo en `accent` |
| `SegmentedControl` | Dos o tres pastillas, la elegida en tinta |
| `Check` | Radio o checkbox, `ink` o `success` |
| `Chip` | Pastilla de opción |
| `FieldRow` | "Nombre …… valor" con input a la derecha |
| `SearchField` | Buscador en pastilla con cancelar |
| `DayPicker` | Siete círculos, lunes a domingo |
| `Sheet` | Hoja inferior con título y cerrar |
| `Banner`, `Tooltip` | Aviso oscuro arriba; burbuja que explica un no |
| `ProgressDots`, `ProgressBar` | Puntos del onboarding; barra fina, con segmentos |
| `AppIcon`, `AppIconStack` | Tile con letra que hace de icono de app; pila "+N" |
| `HeroObject` | El objeto central: tile con la grilla de semanas |
| `StatCard` | Etiqueta, cifra grande, frase |
| `BarChart`, `HorizontalBars`, `DotGrid` | Barras verticales con guías y promedio; barras horizontales; grilla de cuadros |
| `FatalError` | La única pantalla que existe porque algo se rompió |

## Cómo se escribe una pantalla

Ver `docs/PROTOTYPE_GUIDE.md`. Resumen: importa de `src/design/components`, `src/data` y
`src/lib`/`src/domain`; un botón primario en el `footer`; todo texto desde `useStrings()`,
en español neutro de tú y en inglés con la misma voz (ADR-0020).
