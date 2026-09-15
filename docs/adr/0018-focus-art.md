# ADR-0018 — Arte de foco: una ilustración que se dibuja punto a punto durante la sesión

**Estado:** aceptada · 2026-09-15

## Contexto

Durante una sesión la pantalla es un reloj. Se pidió una opción sutil: un dibujo de
estilo puntillista, de aire asiático y antiguo, que se complete exactamente cuando
termina el timer. Un castillo chino, la torre Eiffel, un rostro, un perro, la Estatua
de la Libertad, al azar. Y la condición: que no sature la app.

Las opciones para el contenido:

1. **Imágenes convertidas a puntos fuera de la app.** Realistas, pero pesan, dependen de
   fotos con licencia y se ven como un halftone de foto, no como tinta.
2. **Trazos vectoriales escritos a mano + un motor de puntillismo.** Cada obra son unas
   decenas de polilíneas en orden de dibujo, como el orden de trazos de la caligrafía.
   Pesa kilobytes, no necesita red ni licencias, y el estilo es el nuestro: tinta sobre
   fondo oscuro. El riesgo es la calidad del dibujo a mano.
3. **Generar con IA en tiempo real.** Requiere red y backend. Contradice local-first.

Para renderizar: `react-native-svg` con un solo `Path` que contiene todos los puntos
visibles. Miles de puntos en un elemento; una vista por punto sería inviable.

## Decisión

Opción 2.

- **Motor puro** en `src/domain/art/`: `stipple(obra, presupuesto, semilla)` reparte un
  presupuesto de puntos entre los trazos según su longitud y peso, con un temblor
  determinista; `visibleDots(total, transcurrido, planificado)` es lineal: el último
  punto cae cuando termina el timer. Una sesión cancelada deja la obra sin terminar, que
  es la imagen honesta.
- **Galería** en `src/domain/art/works/`, un archivo por obra, registrada en `index.ts`.
  La obra de una sesión se elige por semilla del id de sesión: al azar, pero fija para
  esa sesión.
- **UI mínima**: un texto sutil "Arte" bajo el reloj de la sesión. Al tocarlo el reloj
  se achica y el dibujo ocupa el centro, con el nombre de la obra debajo. Tocar el
  dibujo vuelve. No hay ajustes, ni galería para explorar, ni compartir. Se mantiene el
  tema oscuro y los dos tonos.
- **Revisión visual obligatoria**: `scripts/artPreview.ts` exporta cada obra a SVG y PNG
  (a 25 %, 50 %, 75 % y 100 %). Ninguna obra entra sin haberse mirado.

## Consecuencias

- Una dependencia nativa nueva, `react-native-svg`, y `tsx` como herramienta de desarrollo
  para el visor.
- El presupuesto de puntos crece con la sesión: unos 3.000 para 25 minutos, hasta 6.000.
  Un punto cada medio segundo se percibe como dibujo lento; el reloj de un segundo lo
  gobierna, sin animación propia.
- El dibujo no reemplaza al reloj ni cambia las reglas de salida. Es una vista, no un
  estado.
- Las obras se escriben a mano y se juzgan a ojo. Las que no convencen no entran; mejor
  tres buenas que ocho regulares.
