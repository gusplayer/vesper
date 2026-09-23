# Guía del prototipo — cómo se escribe una pantalla

Vale para todo lo que vive en `src/app/` y `src/features/` desde ADR-0016. Es corta a
propósito: si una pantalla necesita algo que no está aquí, falta un componente o un
hook, no una excepción. "Prototipo" es el nombre histórico: desde ADR-0017 lo que hay
detrás es real (SQLite, notificaciones, Salud, Live Activity, bloqueo).

## Referencia visual

Brick (iOS, Mobbin). Tarjetas blancas de radio grande sobre un gris cálido, un botón
pastilla oscuro pinneado abajo, listas con chevron, toggles en tinta, barra de pestañas de
solo texto con punto. Durante la sesión activa el tema se invierte a oscuro. Sans
geométrica (Outfit). Sin rebotes, sin springs.

## Reglas

1. **Una pantalla importa solo de tres lugares**: `src/design/components` (el índice),
   `src/data` (hooks y stores), y `src/lib` / `src/domain` para lógica pura. Nunca
   `src/design/tokens` ni `src/design/theme`, nunca `StyleSheet` con números.
2. **Layout con componentes**: `Screen` (fondo, safe area, márgenes, `footer` pinneado),
   `Stack` (gaps), `Section` (título + contenido), `Card`, `ListGroup` + `ListRow`.
   Si necesitas un `View` con estilo, es un componente nuevo en `src/design/components/`.
3. **Texto solo con `Text`**: `variant` = hero | title | heading | body | label | caption;
   `tone` = primary | secondary | tertiary | onInk | accent | danger.
4. **Un botón primario por pantalla**, en el `footer` de `Screen`. Acciones secundarias
   como `Button variant="ghost"` debajo, o como texto en una `ListRow`.
5. **Encabezado**: `PageHeader` con `onBack` (chevron), `onClose` (x) o `title` centrado y
   `right` (normalmente `IconCircle name="plus"`). Las pestañas no llevan back.
6. **Datos**: solo hooks de `src/data` (`useModes`, `useMode`, `useActiveMode`,
   `useSchedules`, `useSettings`, `useRunningSession`, `useTodayFocusMs`, `useDayStats`,
   `useWeekStats`, `useWeekProgress`, `useHabitsWeek`, `useLife`; los del círculo:
   `useProfile`, `useSharePrefs`, `useCircleMembers`, `usePendingInvites`, `useCircleWeek`,
   `useKudosGivenToday`, `useKudosReceived`, `useChallenges`, `useChallenge`,
   `useChallengeStandings`, `useInviteCode`; los catálogos, que siguen el idioma:
   `useApps`, `useActivities`, `useModeIdeas`, `appsById`, `websitesById`, `WEBSITES`,
   `USAGE`, `HEALTH`) y acciones de `useAppStore`, `useFocusStore` y `useCircleStore`.
   Los borradores entre rutas viven en `src/data/modeDraft.ts`, `onboardingDraft.ts` y
   `modes.ts` (`usePlannedStore`). Si falta una acción, se agrega al store, no se inventa
   estado paralelo en la pantalla. Una pantalla nunca importa de `src/platform/`
   salvo `status()` para decir por qué algo no está; las capacidades se aplican solas
   desde `src/platform/hooks/`.
7. **Formato**: `durationText`, `timerText`, `minutesText`, `dayText` de `src/lib/format`.
   Nunca concatenar "h" y "m" a mano.
8. **Ningún string en la pantalla.** `const t = useStrings()` y `t.<área>.<pantalla>.<clave>`;
   cada clave existe en `src/i18n/es/<área>.ts` y en `src/i18n/en/<área>.ts` (ADR-0020).
   Copy en español neutro, de tú, en oración ("Toca para enfocar", "Elige un modo"). Nunca
   voseo (tocá, podés, vos) ni usted ni regionalismos. Sin mayúsculas completas salvo la
   palabra VESPER del objeto. El inglés con la misma voz: "Tap to focus", "Pick a mode",
   sin exclamaciones. Fechas y números con `useLocale().tag`.
9. **Lo que no existe, se dice.** Cada permiso se pide de verdad en su flujo
   (`platform/*.requestAuthorization()`), y donde la capacidad no está —simulador,
   Android sin Salud, iPhone sin entitlement— la pantalla muestra `status().reason` en
   una línea pequeña. Nunca un permiso "concedido" con un flag (ADR-0017). De
   demostración quedan el círculo (`platform/circle.status()` lo dice) y, solo en iOS,
   el uso por app (`platform/usage.status()` lo dice, ADR-0029).
10. **Sin dependencias nuevas.** Barras, grillas y gráficos se dibujan con los componentes
    (`BarChart`, `HorizontalBars`, `DotGrid`, `ProgressBar`).

## Mapa de pantallas

| Ruta | Referencia en Brick |
|---|---|
| `(tabs)/index` | Home: píldora "Xh Ym enfocado hoy" arriba (solo hoy; la semana vive en Actividad) y debajo la línea de la racha ("12 días seguidos · 2 de gracia", "Sin racha todavía. Hoy cuentan 10 minutos." o "Ayer usaste un día de gracia. Llevas 12 días.", ADR-0027), `HeatGrid` de cuatro semanas, nombre del modo + "bloquea N apps", línea de la próxima rutina, fila de duración "25 min ⌄" (`DurationPicker`: hoja con chips y "Sin límite") y el botón "Enfocarme 25 min" / "Enfocarme sin límite", que arranca con un toque; solo con un modo profundo es `HoldButton` y dice "Mantén para enfocarme 25 min", sin ninguna línea debajo (la profundidad se cambia en el modo, no aquí). Al arrancar, por toque o por mantener, `InkFlood` inunda la página de tinta punteada desde el botón y la sesión aparece debajo; el mantener, además, va llenando la pastilla de puntos de papel desde los extremos hacia el centro. Con sesión corriendo: línea "En sesión · 12m de 25m" y el botón dice "Seguir"; `SessionGate` lleva a la sesión sola al relanzar o cuando una rutina la arranca, cierra la sesión al vencer y termina la pausa a los 15 min. Banner opcional (`settings.pendingBanner`). |
| `session/active` | Tema oscuro (lo pone el store). "Llevas enfocado" + `hero` con el tiempo, objeto, modo, "ver modos ›". Arriba a la derecha, `IconCircle` `life-buoy` que abre `session/emergency` (también en la vista del arte). Pie de dos: "Terminar" (abre `session/exit`) y "Pausa de 15 min" (ghost; "Pausa en 12m" mientras no se habilita). En profundo el pie va vacío y bajo la barra una caption dice "Profundo · solo el timer termina". Sesión sin límite: sin barra, línea "Sin límite · desde las 8:05". La pausa entra con el papel disolviéndose desde el botón (`InkFlood tone="paper"`, ADR-0025) y debajo la misma ruta en tema claro: "Pausa", reloj hacia abajo, "Vuelves a las 10:32…", primario "Volver ahora" (corre la tinta desde el botón y debajo vuelve la sesión oscura), ghost "Terminar la sesión". Si la pausa vence sola, vuelve con el fade de ruta. |
| `session/active?art=1` | Arte de foco (ADR-0018): el reloj se achica y una obra puntillista se dibuja al ritmo de la sesión. Obras en `src/domain/art/works/`, motor en `src/domain/art/`, visor `npx tsx scripts/artPreview.ts <dir> --file <obra>`. |
| `session/exit` | La salida consciente (`domain/exitRitual`, ADR-0025), oscura. El usuario mantiene el tile (`BreathingObject`) y respira con él 4-4-6: las celdas se encienden de abajo hacia arriba al inhalar, quedan al sostener y se apagan al exhalar; encima, la palabra de la fase y los segundos; una `ProgressBar` fina lleva el total. Suave: una ronda; firme: dos. Soltar a mitad de ronda la reinicia (`releaseBreath`); las completas se conservan. Al terminar, "Lo hecho queda contado; lo que falta, no" y el ghost se habilita: "Terminar · llevas 12m" (suave) o "Quiero terminar" (firme, que pasa a la frase "Elijo dejar esto ahora" y el motivo opcional). "Seguir enfocado" es siempre el primario. Confirmar corre el papel desde el botón (`InkFlood tone="paper"`) y debajo aparece `session/closed`. Profundo no llega aquí. |
| `session/emergency` | Ruta oscura a pantalla completa (ADR-0025), desde el `life-buoy` de la sesión. Tile en reposo, una línea con el costo (uno de los cinco del mes), la espera de 10 s como `ProgressBar`, primario "Seguir enfocado" y ghost "Usar un desbloqueo" que se habilita al final de la espera y corre el papel hacia `session/closed`. Sin desbloqueos, la ruta lo dice y solo queda el primario. |
| `session/closed` | Ruta clara y breve (ADR-0025), sin gesto de volver: "Sesión cerrada.", "12m quedan contados.", filas Modo / Duración / Motivo (si se escribió) y, si fue emergencia, "Usaste un desbloqueo. Te quedan 3 este mes." Botón Continuar. No celebra: eso es `session/complete`. |
| `session/complete` | "Primera sesión completa." / "Sesión completa." + tarjeta con Modo, Apps bloqueadas, Duración + botón Continuar. Si es la sesión número N, título "Recuperaste tu tiempo". Solo llega la sesión que vence; una cancelada va a `session/closed`. |
| `modes/index` | Lista de tarjetas: nombre, "Bloquea N apps · M sitios", `AppIconStack`, botón Editar, menú "…" (hoja con Duplicar / Eliminar con confirmación), radio de activo con check verde. Tarjeta "Explorar ideas". `+` arriba a la derecha. |
| `modes/edit` | `FieldRow` Nombre, tarjeta "Comportamiento" con `SegmentedControl` (Bloquear seleccionadas / Permitir solo seleccionadas), filas Apps (N ›) y Sitios (N ›) con `AppIconStack`, sección Profundidad (suave/firme/profundo con descripción), botón Guardar modo, "Eliminar modo" ghost. |
| `modes/apps` | Búsqueda, "Seleccionadas N / 50", lista con `AppTile` + nombre + categoría + `Check shape="box"`. Botón Listo. Con `?native=1` muestra el selector real: el de Screen Time en iOS (`BlockingSelectionView`, token opaco) o la lista de apps con lanzador en Android (`ListRow` con `AppTile` e icono real); sin la capacidad, la razón y "Volver". Con `?onboarding=1` escribe en el borrador del onboarding y sigue al paso de Screen Time. |
| `modes/websites` | Igual con `WEBSITES`: buscador, Seleccionados, Populares. |
| `modes/ideas` | Hoja o pantalla "Explorar ideas": tarjetas con icono, nombre, descripción, `+` que crea el modo. |
| `(tabs)/schedules` | Lista de tarjetas: nombre, "9:00 – 18:00 · Entre semana", "Modo: X", toggle. Abajo "Crear horario" con `IconCircle plus`. Con sesión activa, tooltip "No se pueden agregar horarios durante una sesión". |
| `schedules/edit` | Hoja/pantalla "Agregar horario": Nombre, Empieza / Termina (selector de hora simple: chips de horas o +/- 15 min, no hay picker nativo), Modo (hoja para elegir), Repetir con `DayPicker`, aviso "Horarios superpuestos" si choca, botón Guardar. |
| `(tabs)/activity` | Título con chevron que abre hoja "Ver": Semanal / Mensual / De por vida. Semanal: "Tiempo enfocado promedio" + "12% vs semana pasada", `BarChart` 7 días con guías y PROM, tarjetas por día (Hoy, mié 24) con duración, N sesiones y `ProgressBar segments`. Mensual: total, promedio diario, `BarChart` por día del mes, tarjeta "Patrones · Tu ritmo semanal" con `HorizontalBars`. De por vida: `StatCard tone="ink"` "Horas enfocado", `StatCard` "Días enfocado" con `DotGrid` por mes, y **lo de Vesper**: meta semanal (tocable → hoja con chips 5/10/15/20/ninguna), sección "Racha" (tarjeta con los días seguidos, los días de gracia que quedan en el mes y cómo se aplican, ADR-0027), hábitos de la semana (`ListRow` con "3 de 4" y check, tocable marca hoy; mantener → editar), "Hoy" con libro mayor (trabajo, redes estimado con el desglose por app bajo la fila, hasta cinco `AppRow` con icono real en Android o tile de demostración, y la nota de por qué es demostración, ADR-0029; sin registrar), y tarjeta Vida con semanas restantes + `DotGrid` de semanas. Semanal cierra con la sección "Tu círculo" (ADR-0021): hasta cuatro personas con `Avatar`, horas de foco, la línea "redes · Xh (estimado)" si la comparten y el chip "Dar ánimo" / "Enviado"; "Ver círculo ›". Sin perfil, una tarjeta quieta que lleva a `settings/circle`; sin gente, una que lleva a `circle/invite`. Solo en "Esta semana". |
| `(tabs)/settings` | Tarjeta "Este teléfono · sin cuenta, local". Grupo: Mis reglas ›, Desbloqueo de emergencia (5 ›). Grupo: Live Activities (On ›), Notificaciones (On ›), Salud (Conectada/No ›). Grupo: Vida (fecha de nacimiento) ›, Círculo (perfil o "sin perfil") ›, Idioma (Automático / Español / English) ›, Centro de ayuda ›, Acerca de ›. Fila "Borrar todo y reiniciar" con confirmación. Pie: VESPER, versión, Términos · Privacidad. |
| `settings/*` | Cada una una `ListGroup` de filas con toggle o valor y su descripción, como Brick. Reglas: cuatro toggles; el pie dice cuáles llegan al sistema (solo el filtro de contenido adulto, y solo en iOS). Emergencia: tarjeta con "N restantes" y dos captions, cuántos hay por mes y que se usa desde la sesión con diez segundos de espera; sin botón (ADR-0025). Notificaciones: permiso real y cuatro grupos (ADR-0027): General (acompañamiento, fin de sesión, cierre semanal), Cada día (racha en riesgo, día sin foco, volver, y la fila "Hora del aviso" que abre `ReminderTimeSheet`, chips de 8:00 a 21:00) con el pie del presupuesto (dos al día, nada de 22:00 a 8:00, nunca en sesión), Círculo (empujones, sin servidor todavía) y Sistema (novedades); abajo, un aviso de prueba. Live Activities: un toggle y la razón si no hay. Salud: tres bloques y "Conectar Salud" (HealthKit real; deshabilitado con la razón donde no existe) o el resumen de la semana (`HealthWeekSummary`) y "Desconectar". Vida: fecha de nacimiento, país y sexo opcionales que ajustan la esperanza (`domain/lifeExpectancy`), esperanza editable; Guardar. Idioma: tres filas con radio, sin botón (ADR-0020). |
| `circle/index` | "Tu círculo" con `user-plus` arriba a la derecha. Si alguien te dio ánimo, una línea: "Ana y Luis te dieron ánimo esta semana". Sección "Esta semana": una `ListRow` por persona (ordenadas por horas de foco y nada más, sin posiciones) con el chip de ánimo; tu fila dice "Tú" y no tiene chip. Sección "Retos": una tarjeta por reto (nombre, "4 veces por semana · 2 semanas · con Ana y Luis", una línea por persona "Ana · 3 de 4 ✓") y `ListRow` "Nuevo reto". Sin perfil: explicación + botón "Crear tu perfil". Al pie, la razón de `platform/circle` (no hay conexión con otros teléfonos). |
| `circle/invite` | Tarjeta con tu código grande, su `QrCode` (siempre en paleta clara) y dos líneas: quien lo use te pide entrar; la cámara del teléfono abre Vesper. Botón primario "Compartir invitación" (hoja del sistema con el código y el link `vesper://circle/join?code=…`); "Generar código nuevo" ghost tras confirmación. "Quieren entrar a tu círculo" con chips Aceptar / Rechazar. Sección aparte "¿Te dieron un código?": `FieldRow` (acepta un link pegado) + "Pedir entrar a su círculo"; el resultado en la línea de ayuda. "En tu círculo" (N de 12) con "Quitar" tras confirmación. Pie: "En el prototipo nadie recibe la solicitud". |
| `circle/join` | Donde cae el link. Tarjeta "Te invitaron con el código X" y qué significa pedir entrar; botón "Pedir entrar" y, tras el ok, "Ver círculo". Sin perfil, manda a `settings/circle`. Sin código válido, lo dice. |
| `circle/challenge` | `?id`: título = nombre del reto, estado ("Quedan 12 días", "Último día", "Sin límite", "Empieza el lunes", "Terminó") y resumen ("4 veces por semana · 21 días · con Ana y Luis"; "· 2 semanas" cuando son semanas enteras, "· sin límite"). Si alguien te empujó hoy, una línea: "Ana te empujó hoy." `StandingsList`: una fila por persona con `DotGrid` de los siete días, "3 de 4" y check verde al cumplir; bajo cada persona que no marcó hoy, el chip "Empujar" / "Empujado" (una vez al día por persona; solo si estás dentro y el reto está activo), con la nota "Un empujón al día por persona. Llega cuando exista el servidor." (ADR-0027). Botón primario "Marcar hoy" / "Desmarcar hoy" si estás dentro (es la marca de tu hábito) o "Unirme" si no; "Salir del reto" ghost con confirmación. Si no hay lugar entre los cinco hábitos, la línea lo dice y no crea nada. Al pie, la razón de `platform/circle`. |
| `circle/challenge-new` | `FieldRow` Nombre; "Desde un hábito" con chips de tus hábitos activos que rellenan nombre y meta; chips de veces por semana (2–6) y de duración ("1 semana", "2 semanas", "21 días", "4 semanas", "Sin límite"; 21 días por defecto, ADR-0027); "Con quién" con `ListRow` + `Check shape="box"` por persona; chip "Yo también" (encendido por defecto); botón "Crear reto". |
| `settings/circle` | "Perfil": `FieldRow` Nombre y Alias, botón "Crear tu perfil" o "Guardar". "Qué compartes": tres toggles (horas de foco, hábitos y retos, uso de redes) con la nota de que redes es un piso estimado y nada sale del teléfono. Filas "Ver círculo ›" y "Salir del círculo" (danger, con confirmación; el perfil y los hábitos se quedan). |
| `habits/new`, `habits/edit` | Nombre, veces por semana (`Chip` 2/4/6), cómo se cuenta (declarado / verificado si el nombre coincide con salud, `healthTypeFor` de `src/domain/habits`), guardar; en editar, "Archivar" ghost con confirmación. Máximo 5. |
| `onboarding/*` | welcome (`ThemeScope scheme="dark"`: el objeto, "Tu tiempo es tuyo." y botón "Empezar"), goal ("¿Para qué es tu primer modo?" radio list 5 opciones → crea el modo con `MODE_IDEAS`), apps ("Elige las apps a bloquear" → `modes/apps` reutilizada con `params`), screen-time (explicación en tres bloques con iconos + "Permitir acceso"), health (igual, "Conectar Salud" / "Ahora no"), routine ("¿Hacemos X una rutina?" Empieza/Termina + `DayPicker` + Continuar / Saltar), routine-set ("Tu rutina está lista" con la tarjeta del horario + Guardar), notifications ("Sácale el jugo" + Permitir / Ahora no), tour (oscuro, 3 pasos con `ProgressDots`: Toca para enfocar / Estás cubierto en una emergencia / Todo queda en tu teléfono; el último marca `onboardingDone`). Los permisos de screen-time, health y notifications se piden de verdad (`PermissionPage`); "Ahora no" siempre existe. El modo y la rutina del borrador se escriben una sola vez (`features/onboarding/commit.ts`). |

## Pantallas que no están en el mapa

`session/active` en horizontal (solo el reloj grande, el modo y la barra;
`lib/useOrientation`), y las superficies fuera de la app (Live Activity, escudos,
notificación de Android), que no son rutas: ver `PLATFORM_IOS.md` y
`PLATFORM_ANDROID.md`.

## Cómo se verifica

`npx tsc --noEmit` y `npx vitest run` limpios. Después, la app en el simulador:
`npx expo start --dev-client`, con las banderas de `src/dev/route.ts` para caer en la
pantalla sin teclear (`docs/STATUS.md`, "Cómo probar"). Lo que se vio y dónde se anota
en `docs/STATUS.md`.
