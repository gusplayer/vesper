# ADR-0033 — El servidor del círculo: cuenta por dispositivo, sincronía de filas, entrega de empujones

**Estado:** aceptada · 2026-09-22 (el dueño del producto pidió escribirla y ejecutarla)

## Contexto

El círculo (ADR-0021) se construyó entero sobre SQLite con la forma que tendría con un
servidor, y `platform/circle.status()` dice desde entonces que nada sale del teléfono.
Tres decisiones ya aceptadas lo esperan:

- **ADR-0021**: `member_weeks` "es lo que un servidor entregaría"; cuando llegue el sync,
  escribe esa tabla y nada más cambia.
- **ADR-0027 §5**: el empujón y el ánimo agrupado se guardan hoy y se entregan "cuando
  exista el servidor". `prefs.nudges` es un interruptor que no gobierna ningún aviso.
- **ADR-0032**: los retos abiertos por link y los destacados dependen por completo de
  esto, y exigen alias únicos, reporte y bloqueo.

La regla 7 (local-first, sin backend sin ADR) se enmienda aquí, y solo hasta donde hace
falta: **la app sigue funcionando completa sin red y sin cuenta.** Lo que el servidor
agrega es una sola cosa —las filas de otras personas— y nada de la app depende de que
responda.

## Análisis

### Qué tiene que salir del teléfono, y qué no

Sale solo lo que otra persona necesita ver, y solo si el usuario lo eligió (ADR-0021 §4):

- **Perfil**: nombre y alias. El alias pasa a ser único, porque dos `@gus` en un reto son
  una suplantación (ADR-0032 §4).
- **Semana** (`member_weeks`): horas de foco, hábitos hechos y prometidos, y el piso
  estimado de redes **solo si `share.social` está encendido**. Números agregados por
  semana, nunca sesiones.
- **Marcas de reto**: el par (reto, día). Nunca a qué hábito corresponde del lado del
  usuario.
- **Ánimo, empujón, invitación, entrada**: quién, a quién, qué día.

No sale nunca: sesiones, intenciones, modos, apps, sitios, nada de Tiempo de uso ni de
`DeviceActivityReport` (ADR-0004), nada de Salud, ni el uso por app del ADR-0029.
La app es la que agrega; el servidor recibe totales.

### Identidad: una cuenta que es un secreto en el teléfono

Un correo y una contraseña son dos pantallas, un proveedor de identidad, correos de
recuperación y un dato personal más que guardar. Para lo que el círculo necesita —que
una fila sea de alguien y que ese alguien vuelva mañana— basta con:

- El teléfono genera **un id (UUID v7, como todo) y un secreto** de 32 bytes la primera
  vez que sincroniza, y los guarda en el llavero del sistema (`expo-secure-store`).
- Cada petición va con `Authorization: Bearer <id>.<secreto>`; el servidor guarda solo
  el hash del secreto (SHA-256), como una contraseña.
- **Reinstalar pierde la cuenta**, y eso hay que decirlo: Ajustes › Círculo muestra una
  frase de respaldo (el secreto en base32, seis grupos) con "Guarda esto para recuperar
  tu círculo en otro teléfono". Es la misma decisión que toman las apps de mensajería
  locales, y evita pedir un correo antes de que el círculo demuestre que vale la pena.
- Cuando ADR-0032 traiga desconocidos, esta cuenta ya sirve: lo que falta ahí es
  reportar y bloquear, no identidad.

### Sincronía: filas con `updated_at`, el teléfono manda sobre lo suyo

No hay resolución de conflictos que inventar: **cada fila tiene un dueño**. Mi semana la
escribo yo, mi marca la escribo yo, el ánimo lo escribe quien lo da. El servidor rechaza
escribir filas de otro. Entonces:

- `POST /sync` sube mis filas cambiadas desde `since` y baja las de los demás con
  `updated_at > since`. Un solo viaje, un solo cursor por dispositivo.
- Es *last write wins* por fila y dueño, que con un único escritor por fila no pierde nada.
- El teléfono sigue leyendo de SQLite siempre. El sync **escribe en las mismas tablas**
  que hoy llena la siembra (`circle_members`, `member_weeks`, `challenge_marks`, `kudos`,
  `nudges`, `challenges`), así que ninguna pantalla cambia.

### Entrega: Expo push, con las reglas del ADR-0027 intactas

El servidor manda a Expo (`exp.host/--/api/v2/push/send`) y el teléfono registra su token
en `/device`. Lo que el servidor manda es **solo lo que otra persona hizo**: empujón,
ánimo agrupado al final del día, entrada al círculo, invitación a un reto. El presupuesto,
las horas de silencio y el silencio en sesión son del teléfono, no del servidor: un push
que llega en sesión se retiene y se muestra al cerrar (ADR-0027 §1), y eso ya está escrito
del lado del cliente. El servidor respeta una cosa sola: la zona horaria del receptor para
el ánimo agrupado, y su interruptor `nudges`.

### Dónde corre

Railway (donde ya corre lo demás del dueño) con Postgres en Neon, y el servicio en
TypeScript con Hono sobre Node. Se descartó Supabase y Convex por la misma razón que el
ADR-0021 descartó agregarlos entonces: el servidor hace cinco cosas y todas son SQL con
permisos por dueño; un BaaS traería su SDK, su modelo de auth y su acoplamiento para
ahorrar doscientas líneas. Postgres plano se puede mover a cualquier parte.

## Decisión

1. **`server/`, en este repo**, con su propio `package.json`. No entra al bundle de Expo
   (Metro lo excluye) y se despliega solo.
2. **Cuenta por dispositivo**: id + secreto, hash en el servidor, frase de respaldo en
   Ajustes › Círculo. Sin correo, sin contraseña, sin proveedor de identidad.
3. **Alias únicos**, minúsculas, 3 a 20 caracteres, `[a-z0-9_]`.
4. **Un endpoint de sincronía** (`POST /sync`) con cursor `since`, más los de acción que
   necesitan validación del servidor: `/account`, `/device`, `/invite/redeem`,
   `/invite/accept`, `/challenge/join`.
5. **Expo push** para lo que otra persona hizo, con el interruptor del receptor.
6. **Borrado**: `DELETE /account` borra la cuenta y todas sus filas, y devuelve 204. Es
   requisito de tienda y de decencia.
7. **La app sin red sigue completa.** `platform/circle.status()` deja de ser `false` fijo
   y pasa a decir la verdad: sin cuenta, sin conexión, sincronizado hace un rato. Nada se
   presenta como real si no lo es (regla 8, ADR-0017).
8. **La siembra de demostración se apaga en cuanto hay cuenta.** Mientras no haya cuenta,
   el círculo sigue mostrando los datos de ejemplo y diciéndolo.

## Qué NO hace este ADR

- No trae retos públicos: eso es el ADR-0032 y va después, con reporte y bloqueo.
- No trae telemetría ni analítica. Si algún día se mide, es opt-in y es otro ADR.
- No trae recuperación por correo ni cuentas en varios teléfonos a la vez.

## Consecuencias

- Hay datos de personas en un servidor: alias, nombre y números agregados por semana.
  Hace falta una política de privacidad antes de publicar, y el borrado del punto 6.
- Costo mensual de Railway y Neon, pequeño pero real.
- El cliente gana una capa nueva (`src/platform/circleApi.ts` y un hook de sincronía) y
  una migración para el cursor y la cuenta. Ninguna pantalla cambia de forma.
- Riesgo asumido: reinstalar sin guardar la frase pierde el círculo. Se dice en la
  pantalla, no se esconde.

---

**Nota al pie (2026-09-23).** El punto de este ADR que dice que "un push que llega en
sesión se retiene y se muestra al cerrar, y eso ya está escrito del lado del cliente"
describe algo que no existe: `server/src/push.ts` manda una alerta visible, que el
sistema muestra antes de que la app la vea, y no hay cliente de push en `src/`. La forma
correcta de entrega se decide en **ADR-0037**. El resto de este ADR sigue vigente.
