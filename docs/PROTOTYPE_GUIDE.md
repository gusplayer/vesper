# Guía del prototipo — cómo se escribe una pantalla

Vale para todo lo que vive en `src/app/` desde ADR-0016. Es corta a propósito: si una
pantalla necesita algo que no está aquí, falta un componente o un hook, no una excepción.

## Referencia visual

Brick (iOS, Mobbin). Tarjetas blancas de radio grande sobre un gris cálido, un botón
pastilla oscuro pinneado abajo, listas con chevron, toggles azules, barra de pestañas de
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
6. **Datos**: solo hooks de `src/data` (`useModes`, `useActiveMode`, `useSchedules`,
   `useSettings`, `useRunningSession`, `useTodayFocusMs`, `useWeekStats`, `useDayStats`,
   `useWeekProgress`, `useHabitsWeek`, `useLife`, `appsById`, `websitesById`, `APPS`,
   `WEBSITES`, `MODE_IDEAS`, `USAGE`, `HEALTH`, `ACTIVITIES`) y acciones de `useAppStore`
   / `useFocusStore`. Si falta una acción, se agrega al store, no se inventa estado
   paralelo en la pantalla.
7. **Formato**: `durationText`, `timerText`, `minutesText`, `dayText` de `src/lib/format`.
   Nunca concatenar "h" y "m" a mano.
8. **Ningún string en la pantalla.** `const t = useStrings()` y `t.<área>.<pantalla>.<clave>`;
   cada clave existe en `src/i18n/es/<área>.ts` y en `src/i18n/en/<área>.ts` (ADR-0020).
   Copy en español neutro, de tú, en oración ("Toca para enfocar", "Elige un modo"). Nunca
   voseo (tocá, podés, vos) ni usted ni regionalismos. Sin mayúsculas completas salvo la
   palabra VESPER del objeto. El inglés con la misma voz: "Tap to focus", "Pick a mode",
   sin exclamaciones. Fechas y números con `useLocale().tag`.
9. **Nada es real.** Los permisos (Screen Time, Salud, notificaciones) se "conceden" con
   un botón que cambia un flag en settings. Que la pantalla lo diga en una línea
   pequeña cuando corresponda: "en el prototipo esto no pide permiso de verdad".
10. **Sin dependencias nuevas.** Barras, grillas y gráficos se dibujan con los componentes
    (`BarChart`, `HorizontalBars`, `DotGrid`, `ProgressBar`).

## Mapa de pantallas

| Ruta | Referencia en Brick |
|---|---|
| `(tabs)/index` | Home: contador "Xh Ym hoy" arriba, `HeroObject`, nombre del modo + "bloquea N apps", "Gestionar modos ›", botón "Toca o mantén para enfocar". Con sesión corriendo el botón dice "Seguir". Banner opcional (`settings.pendingBanner`). |
| `session/active` | Tema oscuro (lo pone el store). "Llevas enfocado" + `hero` con el tiempo, objeto, modo, "ver modos ›", botón "Terminar" según profundidad (suave: termina; firme: hoja "¿por qué?" + espera 15 s; profundo: no responde, el botón lo dice). Intención editable. |
| `session/active?art=1` | Arte de foco (ADR-0018): el reloj se achica y una obra puntillista se dibuja al ritmo de la sesión. Obras en `src/domain/art/works/`, motor en `src/domain/art/`, visor `npx tsx scripts/artPreview.ts <dir> --file <obra>`. |
| `session/exit` | La salida consciente (`domain/exitRitual`): suave respira 3 rondas y confirma; firme además escribe la frase y dice por qué; profundo no tiene salida. "Seguir enfocado" es siempre el botón primario. La emergencia es una hoja aparte con 10 s de espera. |
| `session/complete` | "Primera sesión completa." / "Sesión completa." + tarjeta con Modo, Apps bloqueadas, Duración + botón Continuar. Si es la sesión número N, título "Recuperaste tu tiempo". |
| `modes/index` | Lista de tarjetas: nombre, "Bloquea N apps · M sitios", `AppIconStack`, botón Editar, menú "…" (hoja con Duplicar / Eliminar con confirmación), radio de activo con check verde. Tarjeta "Explorar ideas". `+` arriba a la derecha. |
| `modes/edit` | `FieldRow` Nombre, tarjeta "Comportamiento" con `SegmentedControl` (Bloquear seleccionadas / Permitir solo seleccionadas), filas Apps (N ›) y Sitios (N ›) con `AppIconStack`, sección Profundidad (suave/firme/profundo con descripción), botón Guardar modo, "Eliminar modo" ghost. |
| `modes/apps` | Búsqueda, "Seleccionadas N / 50", lista con `AppIcon` + nombre + categoría + `Check shape="box"`. Botón Listo. |
| `modes/websites` | Igual con `WEBSITES`: buscador, Seleccionados, Populares. |
| `modes/ideas` | Hoja o pantalla "Explorar ideas": tarjetas con icono, nombre, descripción, `+` que crea el modo. |
| `(tabs)/schedules` | Lista de tarjetas: nombre, "9:00 – 18:00 · Entre semana", "Modo: X", toggle. Abajo "Crear horario" con `IconCircle plus`. Con sesión activa, tooltip "No se pueden agregar horarios durante una sesión". |
| `schedules/edit` | Hoja/pantalla "Agregar horario": Nombre, Empieza / Termina (selector de hora simple: chips de horas o +/- 15 min, no hay picker nativo), Modo (hoja para elegir), Repetir con `DayPicker`, aviso "Horarios superpuestos" si choca, botón Guardar. |
| `(tabs)/activity` | Título con chevron que abre hoja "Ver": Semanal / Mensual / De por vida. Semanal: "Tiempo enfocado promedio" + "12% vs semana pasada", `BarChart` 7 días con guías y PROM, tarjetas por día (Hoy, mié 24) con duración, N sesiones y `ProgressBar segments`. Mensual: total, promedio diario, `BarChart` por día del mes, tarjeta "Patrones · Tu ritmo semanal" con `HorizontalBars`. De por vida: `StatCard tone="ink"` "Horas enfocado", `StatCard` "Días enfocado" con `DotGrid` por mes, y **lo de Vesper**: meta semanal (tocable → hoja con chips 5/10/15/20/ninguna), hábitos de la semana (`ListRow` con "3 de 4" y check, tocable marca hoy; mantener → editar), "Hoy" con libro mayor (trabajo, redes estimado, sin registrar), y tarjeta Vida con semanas restantes + `DotGrid` de semanas. |
| `(tabs)/settings` | Tarjeta "Este teléfono · sin cuenta, local". Grupo: Mis reglas ›, Desbloqueo de emergencia (5 ›). Grupo: Live Activities (On ›), Notificaciones (On ›), Salud (Conectada/No ›). Grupo: Vida (fecha de nacimiento) ›, Centro de ayuda ›, Acerca de ›. Pie: VESPER, versión, Términos · Privacidad. |
| `settings/*` | Cada una una `ListGroup` de filas con toggle o valor y su descripción, como Brick. Emergencia: tarjeta con "N restantes" y botón "Usar desbloqueo de emergencia" (habilitado solo con sesión activa). Salud: conectar/desconectar + resumen `HEALTH`. Vida: fecha de nacimiento y esperanza editables (`FieldRow`). |
| `habits/new`, `habits/edit` | Nombre, veces por semana (`Chip` 2/4/6), cómo se cuenta (declarado / verificado si el nombre coincide con salud, `healthTypeFor` de `src/domain/habits`), guardar; en editar, "Archivar" ghost con confirmación. Máximo 5. |
| `onboarding/*` | welcome (oscuro forzado con `ForcedTheme`? no: usa `Card tone="ink"` grande a pantalla completa con título "Tu tiempo es tuyo." y botón "Empezar"), goal ("¿Para qué es tu primer modo?" radio list 5 opciones → crea el modo con `MODE_IDEAS`), apps ("Elige las apps a bloquear" → `modes/apps` reutilizada con `params`), screen-time (explicación en tres bloques con iconos + "Permitir acceso"), health (igual, "Conectar Salud" / "Ahora no"), routine ("¿Hacemos X una rutina?" Empieza/Termina + `DayPicker` + Continuar / Saltar), routine-set ("Tu rutina está lista" con la tarjeta del horario + Guardar), notifications ("Sácale el jugo" + Permitir / Ahora no), tour (3 pasos con `ProgressDots`: Toca para enfocar / Estás cubierto en una emergencia / Todo queda en tu teléfono; el último marca `onboardingDone`). |

## Cómo se verifica

`npx tsc --noEmit` limpio. Después, la app en el simulador: `npx expo start --dev-client`.
