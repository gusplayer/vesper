# ADR-0028 — Abrir la app: la tinta se disuelve hasta dejar la marca

**Estado:** aceptada · 2026-09-17

## Contexto

El splash nativo era una imagen estática: el icono de la app (la grilla de cuatro por
cuatro) sobre papel, y de ahí un corte a la primera pantalla. Dentro de la app ya existe
un lenguaje para entrar y salir: `InkFlood` inunda la página de tinta punteada desde el
botón al empezar una sesión (ADR-0018, ADR-0022) y la disuelve en papel al salir
(ADR-0025). Abrir la app no hablaba ese lenguaje.

El dueño del producto pidió que al abrir la app se vea **solo un cuadro negro**, y que
esa tinta se vaya quitando con la misma disolución punteada hasta dejar **únicamente los
cuadros que representan a Vesper**.

Restricciones que esto toca:

- El splash nativo es una pantalla del sistema: no anima, y en Android 12+ el sistema
  siempre dibuja un icono en el centro (si no se le da uno, usa el de la app).
- Regla 6: nada se anima salvo la opacidad. Regla 3: ningún color literal fuera de
  `tokens.ts`; el splash nativo se declara en `app.json`, que no puede importar tokens.
- expo-router oculta el splash solo cuando el navegador está listo; si la app llama a
  `preventAutoHideAsync`, lo deja en manos de la app.

## Decisión

1. **El splash nativo es una hoja de tinta lisa.** `app.json` declara `#1C1B1A`, el
   mismo `colors.light.ink`, sin ninguna marca encima. En Android 12+ el icono que el
   sistema exige es un PNG de la misma tinta (`assets/splash-ink.png`): recortado en
   círculo sobre el mismo color, no se ve. Un test (`src/design/splash.test.ts`)
   comprueba que `app.json` y el token no se separen.
2. **`BootReveal` toma el relevo en el mismo color.** El layout raíz llama a
   `preventAutoHideAsync` al cargar el módulo y monta `BootReveal` desde el primer
   render, antes de que la fuente esté lista: una hoja de tinta idéntica a la nativa.
   Cuando la hoja está pintada (`onLayout` + un frame), el layout oculta el splash
   nativo. No hay costura visible.
3. **La tinta se disuelve de los bordes hacia el centro** con `dissolveLayers`, la misma
   trama de `InkFlood` (`motion.dissolve`), en `motion.revealMs`. Lo último en irse es lo
   que rodea a la marca: la grilla de cuatro por cuatro del icono, nueve celdas en tinta
   y siete en `inkTertiary`, dibujada debajo de la tinta en `layout.mark`. Sin tile, sin
   sombra, sin la palabra: solo los cuadros.
4. **La marca espera a la app y se va en un fade.** Cuando la tinta ya no está y la
   fuente cargó (la app está montada debajo), la marca se queda `motion.revealHoldMs` y
   la capa entera se desvanece en `motion.fadeMs`, el fade de ruta de siempre. El layout
   la desmonta al terminar.
5. **La barra de estado sigue a la tinta.** Clara mientras la hoja es tinta; después, la
   del esquema.
6. **"Reducir movimiento"**: la tinta simplemente no está (la marca sobre la página) y
   solo queda el fade final. Se lee una vez al montar (`readReduceMotion`), no con el
   hook, porque la animación empieza antes de que el hook resuelva.
7. **La curva es de entrada y salida** (`Easing.inOut(quad)`), no solo de salida como en
   `InkFlood`: la página parte del reposo, así que los primeros puntos se van despacio y
   los últimos se demoran alrededor de la marca. `InkFlood` sigue a un toque y arranca
   rápido con razón.

### Lo que Android obliga

El splash de Android 12+ es una ventana del sistema, no una vista de la app, y eso
cambia dos cosas que en iOS no existen (verificado en el emulador, build de Release):

- **Se desvanece, no se quita.** `expo-splash-screen` la retira con un fade de 400 ms por
  defecto; ese fundido uniforme se superponía a la disolución y convertía su primera
  mitad en un simple crossfade. El layout raíz fija `setOptions({ duration: 0 })`.
- **Se retira cuando la app queda ociosa, no cuando se le pide.** `hide()` solo deja
  pasar el primer dibujado; el sistema transfiere y retira la ventana después, y si el
  hilo de UI está ocupado (rasterizar 24 capas SVG a pantalla completa toma cientos de
  ms en el emulador) la retirada llega tarde y la disolución entera corre debajo. Por
  eso `BootReveal` va por etapas: primero solo la hoja sólida y la marca (baratas);
  cuando los cuadros vuelven a un ritmo estable (`afterSteadyFrames`, dos cuadros
  seguidos de ≤ 40 ms o 1,5 s de plazo) monta las capas debajo de la hoja, y cuando el
  primer rasterizado de las capas quedó atrás, con el mismo criterio, arranca el reloj.
  En iOS esto cuesta unos 50 ms de tinta quieta y nada más.

## Alternativas consideradas

- **Dejar el splash estático.** Es lo que el ADR-0024 (propuesto) da por sentado; ese
  ADR habla de sonido y no decide sobre el splash. Abrir la app seguiría siendo la única
  transición sin el lenguaje de la tinta.
- **Disolver del centro hacia afuera.** Descubre la marca primero y la página después;
  pero la marca aparece de golpe y el resto es ruido. De afuera hacia adentro, la tinta se
  encoge hasta *ser* los cuadros, que es lo que se pidió.
- **Alinear la marca con la grilla del `HeroObject` de Focus** para que la transición sea
  continua. La primera pantalla no siempre es Focus (onboarding, sesión viva por
  `SessionGate`) y la posición del tile depende del layout; la alineación fallaría
  justo cuando más se notaría. Marca centrada y un fade.
- **Un video o Lottie de arranque.** Dependencia nueva, otro formato de assets, y
  seguiría habiendo una costura con el splash del sistema. Todo lo que hace falta ya
  existe en `lib/dissolve`.

## Consecuencias

- Nace `BootReveal` en `design/components` (52 componentes). `useReduceMotion.ts`
  exporta `readReduceMotion`. Tokens nuevos: `motion.revealMs`, `motion.revealHoldMs`,
  `layout.mark`.
- `app.json` cambia el splash; hace falta `expo prebuild` y un dev client nuevo en cada
  plataforma para verlo. `assets/splash-icon.png` desaparece.
- Al arrancar con una sesión viva, el esquema ya es oscuro cuando la tinta se va: la
  tinta del splash (`#1C1B1A`) se disuelve sobre `dark.bg` (`#191919`), casi el mismo
  color, y lo único que se ve aparecer es la marca clara. Es correcto y raro; no se
  ajusta.
- Con la app en dev client, el splash nativo se ve poco: el cliente muestra su propio
  lanzador antes (y en Android lo oculta él mismo y deja papel en blanco mientras baja el
  bundle). La costura solo se juzga en una build de Release: en Android,
  `./gradlew :app:assembleRelease` firma con la clave de debug y se instala con `adb`.
- El emulador de Android dibuja la disolución a unos 10 cuadros por segundo incluso con
  `-gpu host`; en un teléfono real debería ir fluida, pero no se ha medido.
