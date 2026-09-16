# ADR-0020 — La app habla el idioma del teléfono: español e inglés, con override en Ajustes

**Estado:** aceptada · 2026-09-15

## Contexto

Hasta hoy todo el texto que ve el usuario estaba en español y hardcodeado en las
pantallas, en `src/lib/` y en unos pocos archivos de `src/domain/` (`reminders.ts`,
`ledger.ts`, `blocking.ts`, `exitRitual.ts`, `lifeExpectancy.ts`). `ARCHITECTURE.md`
lo dejaba anotado como deuda: "no hay i18n en fase 1, extraído en fase 2".

Llegó la fase 2 para esto. Vesper tiene que abrirse en inglés en un teléfono en inglés,
en español en uno en español, y el usuario tiene que poder forzar uno de los dos desde
Ajustes sin reinstalar ni reiniciar.

Preguntas que había que contestar:

1. ¿Librería de i18n o diccionarios tipados a mano?
2. ¿Cómo sabe la app el idioma del teléfono y qué hace con uno que no es ni español ni inglés?
3. ¿Dónde se guarda la elección manual y cómo llega a cada pantalla?
4. ¿Cómo obtienen texto `src/domain/` y `src/platform/`, que no son React?
5. ¿Qué pasa con las fechas, los números y los datos de demostración?

## Decisión

### Diccionarios tipados a mano, sin librería

- **Dos diccionarios en `src/i18n/es/` y `src/i18n/en/`**, uno por área de la app
  (`common`, `onboarding`, `focus`, `session`, `depth`, `modes`, `routines`, `activity`,
  `habits`, `settings`, `notifications`, `demo`, `format`). `src/i18n/es/index.ts` los
  junta; `Strings = typeof es` es el contrato y `en` lo implementa. Si a `en` le falta
  una clave, `tsc` falla. No hay claves huérfanas ni fallback silencioso.
- **Los textos con variables son funciones**: `sessionEnded: (duration: string) => string`,
  `activeRules: (count: number) => string`. Los plurales se resuelven en la función, en
  cada idioma, sin ICU ni interpolación por strings. TypeScript comprueba los argumentos.
- **Sin `i18n-js`, `i18next` ni `react-intl`.** Son doscientas claves, dos idiomas y una
  app sin red: un objeto tipado hace el trabajo y el bundle no crece.

### Idioma del teléfono, con override

- `expo-localization` (`getLocales()`) es la única fuente del idioma del dispositivo y
  solo se importa en `src/i18n/device.ts`.
- `resolveLocale(preference, deviceLanguages)` en `src/i18n/locale.ts` es pura y está
  testeada: con preferencia `auto` toma el primer idioma del teléfono que sea `es` o
  `en`. **Un teléfono en cualquier otro idioma abre en inglés**: es el idioma que más
  gente lee como segundo. Español es el idioma del proyecto, no el fallback global.
- **La preferencia (`auto` | `es` | `en`) se guarda en la tabla `settings`, clave
  `language`**, a través de `settingsRepo`. Se hidrata en el arranque junto con el resto
  de los stores; "Borrar todo y reiniciar" la borra también, como a todo lo demás.
- **Ajustes › Idioma** es una página con tres filas: "Automático (idioma del teléfono)",
  "Español", "English". Cambiarla re-renderiza la app entera en el acto: todo el texto
  sale de un store de zustand (`useLocaleStore`) y ninguna pantalla cachea strings.

### Cómo llega el texto a cada capa

- **Pantallas y componentes de `features/`**: `const t = useStrings()` y luego
  `t.focus.title`. `src/design/components` sigue sin conocer el dominio y recibe el texto
  por props; la única excepción es `FatalError`, que se muestra antes de que exista
  cualquier store y por eso lleva su texto en los dos idiomas dentro.
- **`src/domain/` sigue puro.** No importa `src/i18n/index.ts` ni el store. Cuando una
  función de dominio produce texto para el usuario, recibe el diccionario (o la rebanada
  que necesita) como parámetro: `scheduleReminders(schedule, modeName, t.notifications)`.
  Los tests le pasan `es` o `en` importados directo de `src/i18n/es` y `src/i18n/en`,
  que son objetos planos sin dependencias nativas.
- **`src/platform/` y los stores** usan `getStrings()`, que lee el store fuera de React.
- **`src/lib/labels.ts`, `format.ts` y `tone.ts`** dejan de tener español dentro. Lo que
  era `DEPTH_LABEL[depth]` es `t.depth.label[depth]`; lo que formatea duraciones recibe
  el `locale` o el diccionario `format`.

### Fechas, números y demo

- Las fechas y los números se formatean con `Intl` y la etiqueta BCP 47 del store
  (`tag`): `es-CO` o `en-US` por defecto, o la región real del teléfono cuando su idioma
  coincide con el elegido (un iPhone en `en-GB` ve fechas británicas). Coma decimal en
  español, punto en inglés; ya no hay `'es-CO'` literal fuera de `src/i18n/`.
- Los datos de demostración (modos, actividades, hábitos de muestra) se siembran una vez
  en el idioma resuelto en ese arranque. Son datos del usuario desde ese momento y no
  cambian al cambiar el idioma, igual que un modo que él mismo nombró.
- La frase del ritual de salida (`EXIT_SENTENCE`) es parte del diccionario: en inglés se
  escribe "I choose to leave this now". La comparación sigue ignorando tildes y puntuación.

### Voz del inglés

Misma voz que el español: segunda persona directa, oraciones cortas, sentence case,
sin signos de exclamación ni tono de marketing. "Tap to focus", "Pick a mode", "You can
change it". Nada de "Let's go!" ni "Awesome!".

## Consecuencias

- Toda string nueva se escribe **dos veces**, en `es/` y en `en/`, o `tsc` no pasa. La
  regla "UI en español" de `CLAUDE.md` pasa a ser "UI en `src/i18n/`, en los dos idiomas".
- `expo-localization` es un módulo nativo: hay que regenerar `ios/` y recompilar el dev
  client (`npx expo prebuild --platform ios --clean && npx expo run:ios`).
- Los tests que comprobaban texto literal en español ahora comprueban contra el
  diccionario o cubren los dos idiomas.
- Un tercer idioma es una carpeta nueva en `src/i18n/` y una fila más en Ajustes › Idioma.
  Nada más.
- Queda fuera: RTL, pluralización de idiomas con más de dos formas, y traducir las
  extensiones nativas de iOS (`targets/`), que reciben su texto desde JS.
