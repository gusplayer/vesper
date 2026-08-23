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
- Línea de contexto: `actividad · profundidad · N apps`
- Botón único: `empezar`
- Libro mayor del día abajo, en tipo pequeño, incluyendo el renglón `sin registrar`

**Regla:** un tap desde abrir la app hasta estar en sesión.

Tocar el número grande abre la configuración de sesión. No hay otro acceso a configuración.

### 2. Sesión activa

- Encabezado: actividad, sesión N de M del día
- Timer grande, centrado, serif
- Intención escrita por el usuario
- Barra de progreso fina
- `mantén pulsado para terminar` — 1.5s, sin diálogo de confirmación

Comportamiento por nivel de profundidad:
- **Suave** — mantener pulsado termina de inmediato
- **Firme** — mantener pulsado abre campo de texto "¿por qué?" y espera 15s
- **Profundo** — mantener pulsado no responde; solo termina el timer

### 3. Vida

- Semanas restantes, número grande
- Cuadrícula de semanas (vividas en tinta, restantes en gris)
- Una línea de proyección: *"a tu ritmo actual, X de eso en redes"*

**Regla:** nunca es la pantalla inicial. Nunca genera notificaciones. Opt-in en onboarding.

## Configuración de sesión

Se abre tocando el número grande. Tres decisiones, todas con valor por defecto
heredado de la última sesión:

| Decisión | Opciones | Default |
|---|---|---|
| Duración | 25 / 50 / 90 / custom (scroll en tap largo) | última usada |
| Actividad | chips de las actividades activas del usuario | última usada |
| Profundidad | suave / firme / profundo | última usada |
| Perfil de bloqueo | nada / redes / todo menos esenciales | última usado |

## Hábitos

Máximo 5. Cada hábito tiene:

- Nombre (texto libre)
- Meta semanal (2× / 4× / 6× o custom)
- Tipo de conteo: **verificado** (Health lo confirma) o **declarado** (el usuario marca o pone timer)

El nombre es texto libre porque hay hábitos que nunca son sesiones de foco —sueño y pasos son
los dos casos verificados— y no caben en la lista de actividades. Ver ADR-0008.

Cuando el nombre coincide con una actividad existente, el hábito se vincula a ella y el libro
mayor muestra un solo renglón en vez de dos que hablan de lo mismo.

El tipo verificado solo está disponible para hábitos mapeables a datos de salud:
entrenamiento, caminata, sueño. Se ofrece por defecto cuando el nombre coincide.

## Metas semanales, no rachas diarias

Un objetivo por semana. Se reinicia el lunes. Pantalla de cierre el domingo.
Las rachas diarias castigan a quien se enferma un martes.

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
| El onboarding pide demasiado | Cero permisos hasta después de la primera sesión completada |
| Estética e-ink se vuelve decorativa | Regla: solo texto, reglas horizontales y cuadros rellenos |
