# Sistema de diseño — Vesper

Estética de tinta electrónica. La referencia es un Kindle, no una app de iOS.

## Principio

Una pantalla de e-ink refresca lento y no tiene color. Eso empuja hacia una UI que es
**texto, reglas horizontales y cuadros rellenos.** Nada más entra.

> Si un elemento no es texto, una regla horizontal o un cuadrado relleno, no va.

## Color

Cuatro tonos. No hay un quinto.

```ts
export const color = {
  ink:      '#1B1A18',  // texto principal, reglas gruesas, cuadros llenos
  ink60:    '#6E6C66',  // etiquetas, texto secundario
  ink30:    '#C9C6BE',  // reglas finas, cuadros vacíos
  paper:    '#F2F0EA',  // fondo
} as const;
```

Reglas:
- Nunca `#000000` ni `#FFFFFF`. El e-ink real no los alcanza y su uso delata la imitación.
- El papel es ligeramente cálido. No lo enfríes.
- Cero color de acento. El estado "hecho" se comunica con la palabra, no con verde.
- Modo oscuro: no existe en v1. Cuando llegue, será papel `#1C1B19` / tinta `#D8D5CD`, nunca invertido a negro puro.

## Tipografía

Serif en toda la app. Es el 70% del efecto.

```ts
export const font = {
  family: 'Literata',        // alternativas: Newsreader, Source Serif 4
  size: {
    display: 44,   // número de duración, semanas restantes
    timer:   50,   // solo el timer de sesión
    title:   26,
    body:    15,
    label:   12,
    caption: 10,
  },
  weight: {
    regular: '400',
    medium:  '500',
  },
} as const;
```

- **Dos pesos únicamente.** Nunca 600 ni 700.
- En React Native la fuente se direcciona por nombre de familia por peso, no por número:
  `Literata_400Regular` y `Literata_500Medium`. Por eso `tokens.ts` expone
  `font.family.regular` y `font.family.medium` en vez de un solo `family: 'Literata'`.
- La jerarquía la da el tamaño y el tono, no el peso.
- `letter-spacing: -1` en display, `-2` en timer. El resto en 0.
- Números en el mismo serif. No uses una mono para el timer — rompe la coherencia.
- Todo en minúscula excepto nombres propios. Nunca mayúsculas completas.

## Espaciado y forma

```ts
export const space = { xs: 4, sm: 8, md: 14, lg: 18, xl: 24 } as const;
export const radius = { box: 4 } as const;
export const rule = { thick: 1, thin: 0.5, progress: 3 } as const;
```

- Radio máximo 4px. Las esquinas muy redondeadas son lenguaje de iOS, no de papel.
- Márgenes laterales de 16px. Márgenes verticales generosos, como una página.
- Regla **gruesa en tinta** separa el encabezado. Reglas **finas en ink30** separan secciones.
- `rule.progress` son los 3px de `ProgressRule` y `HoldToConfirm`. Es el único grosor
  que no separa nada: mide.
- Cero sombras, cero degradados, cero blur, cero elevación.

## Movimiento

- Transiciones instantáneas por defecto.
- Fade de 120ms como máximo, solo para cambios de pantalla.
- **Prohibido:** spring, escala, rebote, parallax, skeleton shimmer.
- El único movimiento continuo permitido es la barra de progreso de la sesión y la de "mantener pulsado".

## Componentes (16, escritos a mano)

| Componente | Descripción |
|---|---|
| `Screen` | Contenedor con fondo papel y márgenes de página |
| `ScreenHeader` | Fila de etiquetas + regla gruesa debajo |
| `DisplayNumber` | Número grande con sufijo opcional |
| `Timer` | Número de tiempo grande, centrado |
| `Rule` | Regla horizontal, `thick` o `thin` |
| `LedgerRow` | Fila etiqueta ↔ valor. Tocable cuando es un hábito que se marca |
| `Chip` | Opción seleccionable, borde 0.5 o 1 según estado |
| `ChipRow` | Fila de chips que envuelve. Existe porque las pantallas no importan tokens |
| `ChoiceCard` | Opción con título y descripción (profundidad, tipo de hábito) |
| `PrimaryAction` | Bloque con borde de tinta y texto centrado |
| `HoldToConfirm` | Botón de mantener pulsado con barra de progreso |
| `WeekGrid` | Cuadrícula de cuadros de tinta |
| `ProgressRule` | Barra de progreso de 3px |
| `TextField` | Campo con regla debajo, sin caja |
| `Label` | Texto de etiqueta en ink60 |
| `Caption` | Texto de pista en caption size |

Estados seleccionados: borde `1px ink` y texto `ink`.
Estados no seleccionados: borde `0.5px ink30` y texto `ink60`.
No hay estados de fondo relleno.

## Accesibilidad

- El contraste ink/paper es ~13:1. Suficiente.
- ink60 sobre paper es ~4.8:1 — úsalo solo para texto de 12px o mayor.
- ink30 nunca lleva texto, solo reglas y cuadros.
- Respeta `Dynamic Type` hasta un 130%. Más allá, la pantalla de inicio debe permitir scroll.
- `HoldToConfirm` necesita alternativa accesible: doble tap con VoiceOver activo.
