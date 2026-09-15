# PRD — Vesper

## Problema

Las apps de screen time dicen cuánto tiempo perdiste. Ninguna dice cuánto invertiste.
El usuario objetivo no quiere un informe de uso: quiere sentir que su tiempo se está
gastando en lo que eligió.

## Propuesta

Un libro mayor del día. Tres monedas separadas, nunca sumadas:

1. **Tiempo invertido** — sesiones de foco y actividades que el usuario declara con timer.
2. **Tiempo verificado** — gym, pasos, sueño. Confirmado por HealthKit / Health Connect.
3. **Tiempo consumido** — uso de redes. Estimado, siempre presentado como piso.

Y un denominador: las semanas de vida restantes.

## Usuario objetivo

Alguien que ya intentó reducir su uso del teléfono y falló. Sabe que el problema no es
información — es fricción y honestidad. No quiere otro dashboard.

## Las tres pantallas

Sin tab bar. Sin pantalla de ajustes.

El swipe horizontal va entre **inicio y vida**. La sesión activa no es una página del
swipe: es una ruta a pantalla completa de la que solo se sale terminando el timer o
manteniendo pulsado. Si fuera una página, un deslizamiento abandonaría una sesión
`profunda` y el nivel no significaría nada. Ver ADR-0009.

### 1. Inicio (también es la pantalla de arranque de sesión)

- Encabezado: fecha, progreso de la meta semanal
- Duración de la próxima sesión, grande, con la última configuración ya aplicada
- Línea de contexto: `actividad · profundidad · sin bloqueo` en fase 1. Cuando llegue el
  bloqueo, el tercer término pasa a ser el perfil
- Botón único: `empezar`. Si hay una sesión corriendo, dice `seguir` y vuelve a ella
- Libro mayor del día abajo, en tipo pequeño, incluyendo el renglón `sin registrar`

**Regla:** un tap desde abrir la app hasta estar en sesión.

Toda la configuración se abre desde donde se lee, y no hay otro acceso (ADR-0007):

- el número grande → configuración de sesión
- el progreso del encabezado → meta semanal, y el domingo, el cierre de la semana
- `agregar hábito` al pie del libro mayor → nuevo hábito
- mantener pulsada la fila de un hábito → editar o archivar ese hábito

### 2. Sesión activa

- Encabezado: actividad, `sesión N de hoy`
- Timer grande, centrado, serif
- Intención escrita por el usuario, en la misma pantalla
- Barra de progreso fina
- `mantén pulsado para terminar` — 1.5s, sin diálogo de confirmación
- Si hubo interrupciones, una línea que las cuenta. Se anotan, no se castigan
- Al vencer el timer la ruta no se va: muestra la duración servida, la intención tal como
  se escribió y `volver`. Una sesión cancelada no pasa por ahí. Ver ADR-0015

Comportamiento por nivel de profundidad:
- **Suave** — mantener pulsado termina de inmediato
- **Firme** — mantener pulsado abre campo de texto "¿por qué?" y espera 15s. Durante la
  espera hay un texto tocable `seguir` que vuelve a la sesión sin cerrarla
- **Profundo** — mantener pulsado no responde; solo termina el timer

### 3. Vida

- Semanas restantes, número grande
- Cuadrícula de semanas (vividas en tinta, restantes en gris)
- Una línea de proyección: *"a tu ritmo actual, X de eso en redes"*. Llega en fase 3,
  con los datos de uso; hasta entonces la página lo dice en una línea

**Regla:** nunca es la pantalla inicial. Nunca genera notificaciones. Opt-in: la página
está siempre en el pager —no hay onboarding donde declinarla, ADR-0012— y sin fecha de
nacimiento no cuenta nada, solo invita. El opt-in es escribir la fecha ahí mismo.

## Configuración de sesión

Se abre tocando el número grande. Cuatro decisiones, todas con valor por defecto
heredado de la última sesión. Cada cambio se guarda al instante; no hay botón de guardar.

| Decisión | Opciones | Default |
|---|---|---|
| Duración | 25 / 50 / 90 / `otra`, que abre un campo de 1 a 240 minutos | última usada |
| Actividad | chips de las actividades activas + `otra`, que crea una ahí mismo con el nombre tecleado | última usada |
| Profundidad | suave / firme / profundo | última usada |
| Perfil de bloqueo | `nada`, única opción en fase 1. `redes` y `todo menos esenciales` llegan en fase 2 | `nada` |

## Hábitos

Máximo 5. Cada hábito tiene:

- Nombre (texto libre)
- Meta semanal (2× / 4× / 6×; sin valor custom en fase 1)
- Tipo de conteo: **verificado** (Health lo confirma) o **declarado** (el usuario marca o pone timer)

El nombre es texto libre porque hay hábitos que nunca son sesiones de foco —sueño y pasos son
los dos casos verificados— y no caben en la lista de actividades. Ver ADR-0008.

Cuando el nombre coincide con una actividad existente, el hábito se vincula a ella. La
intención es que el libro mayor muestre un solo renglón en vez de dos que hablan de lo
mismo; el vínculo ya se guarda, pero el libro mayor todavía no lo usa.

El tipo verificado solo se desbloquea para hábitos mapeables a datos de salud:
entrenamiento, caminata, sueño. Lo desbloquea el nombre, pero **declarado sigue siendo el
default** hasta la fase 1.5: hoy nada puede marcar un hábito verificado.

Se editan y archivan manteniendo pulsada su fila en el libro mayor. Archivar no borra:
las marcas son historia, y el hábito deja de contar y libera un lugar.

## Metas semanales, no rachas diarias

Un objetivo por semana, en horas de foco. Se reinicia el lunes.
Las rachas diarias castigan a quien se enferma un martes.

Se configura tocando el progreso en el encabezado de inicio, que es donde se lee. **No hay
meta por defecto:** la app no inventa un número contra el cual medirte, y `ninguna` es una
respuesta válida.

El **cierre del domingo** vive en la misma ruta de la meta: ese día el encabezado dice
`cerrar la semana` y la ruta muestra primero cómo cerró, y debajo la meta de la que empieza.
No es una cuarta pantalla. Ver ADR-0013.

## Fuera de alcance en v1

- Bloqueo de apps (fase 2)
- Cuenta de usuario, sync, backend
- Gráficos y estadísticas complejas
- Rachas, badges, leaderboards, social
- Modo oscuro
- Tablet / iPad
- Widgets y Live Activities (fase 1.5)

## Métricas de éxito del prototipo

No son de negocio, son de validación personal:

- ¿El autor de la app la abre 7 días seguidos sin obligarse?
- ¿El tiempo desde abrir hasta estar en sesión es menor a 3 segundos?
- ¿El renglón `sin registrar` provoca alguna reacción?

Si la respuesta a la primera es no, el problema no era el bloqueo.

## Riesgos de producto

| Riesgo | Mitigación |
|---|---|
| La pantalla de vida genera ansiedad | Opt-in, nunca inicial, nunca push, framing de asignación |
| El usuario infla el tiempo declarado | Tope de 6h/día declarables; separación visual de verificado |
| El onboarding pide demasiado | No hay onboarding: una línea en la primera vez, y cero permisos hasta después de la primera sesión completada. Ver ADR-0012 |
| Estética e-ink se vuelve decorativa | Regla: solo texto, reglas horizontales y cuadros rellenos |
