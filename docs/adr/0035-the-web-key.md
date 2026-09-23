# ADR-0035 — La llave en una página web: qué haría falta y por qué no se implementa todavía

**Estado:** propuesta · 2026-09-22 · fase 2 del ADR-0034 · depende del ADR-0033

## Contexto

El ADR-0034 dejó la llave entre dos teléfonos: uno muestra un código que rota cada
treinta segundos, el otro lo escanea para abrir y volver a escanearlo para cerrar, y la
verificación es local. El dueño pidió además que la llave pueda vivir en una página web
—un computador en la cocina, una pantalla en la oficina— y pidió diseñarlo ahora aunque
se implemente después.

Este ADR es ese diseño. No se implementa hasta que la llave entre teléfonos exista y se
use, por una razón que vale más que la comodidad: **la llave web es la primera cosa en
Vesper que puede dejar a alguien encerrado en su teléfono por falta de señal.**

Lo que el servidor es hoy, leído en el árbol:

- Hono 4 sobre Node, un solo `app`, **un solo middleware**: la puerta de autenticación
  en `server/src/app.ts:54`, que responde 401 a todo salvo dos cadenas exactas,
  `POST /account` y `/health`.
- Nada que no sea JSON. Cero `hono/html`, `hono/jsx`, `serve-static` o `cors`; todos los
  manejadores devuelven `c.json`. Los paquetes están en disco, así que servir una página
  no cuesta dependencia nueva: cuesta la ruta, el archivo, un paso de build para el
  JavaScript del navegador y una excepción explícita en esa puerta.
- La cuenta es `id.secreto` en el encabezado, sin expiración, sin alcance, sin rotación y
  sin revocación (`server/src/auth.ts:30`). **Ese token no se le puede dar a un navegador.**
- No hay nada efímero. Ninguna tabla tiene expiración; todo está llaveado por cuenta con
  borrado en cascada y todas las lecturas son un cursor sobre `updated_at`. Una página
  identificada por un token de un solo uso no tiene dónde vivir, y habría que
  implementarla dos veces, en `memoryStore` y en `pgStore`, más su limpieza.
- No hay límite de intentos, ni protección de repetición, de ningún tipo. Un endpoint de
  llave sería lo primero en este servidor que vale la pena forzar por fuerza bruta.
- No hay despliegue, ni dominio, ni URL: `localhost:8787` es la única dirección que
  existe, y en prosa. `docs/STATUS.md` deja "desplegar en Railway + Neon" como decisión
  pendiente.
- La app **todavía no habla con el servidor**: `src/platform/circle.ts` devuelve
  `available: false` fijo y `circleApi.ts` no existe.

## Decisión

### 1. La página muestra la llave; nunca la guarda

El secreto no viaja al navegador. La página pide al servidor el código de la ventana
actual y lo dibuja; el servidor es quien tiene el secreto y quien lo deriva. Así una
pestaña olvidada abierta en un computador compartido no es una llave permanente: es una
pantalla que deja de servir en cuanto el servidor deja de contestarle.

Consecuencia deliberada: la llave web **no funciona sin red del lado de la página**. Eso
es aceptable porque la página es la que muestra, no la que decide.

### 2. El teléfono sigue verificando sin red

Esto no se negocia y es la razón de ser de este ADR. El teléfono conserva su copia del
secreto y verifica el código escaneado contra su propio reloj, exactamente como en el
ADR-0034. La página web cambia **quién muestra**, nunca **quién verifica**. Terminar una
sesión nunca depende de que el teléfono tenga señal.

Si la página no puede mostrar el código porque el computador está sin internet, el
teléfono sigue teniendo la salida de emergencia del ADR-0025 y, si la llave es también
un teléfono emparejado, esa otra llave sigue sirviendo. Una llave web nunca puede ser la
única llave de un teléfono: la pantalla de emparejamiento lo exige.

### 3. Emparejar sin cámara del lado web

El ADR-0034 empareja con el teléfono escaneando lo que la llave muestra, y eso sigue
funcionando aquí: la página muestra su código de emparejamiento y el teléfono lo lee.
Lo que falta es que la página sepa que habló con el teléfono correcto, y para eso hace
falta un apretón de manos de dos pasos que el servidor hoy no tiene:

1. La página pide al servidor una **sesión de emparejamiento**: una fila efímera con un
   token opaco y unos minutos de vida. La página muestra ese token como código.
2. El teléfono lo escanea y lo reclama con su propia cuenta. El servidor genera el
   secreto de la llave, se lo entrega **una sola vez** al teléfono, lo guarda para poder
   derivar códigos, y marca la fila como reclamada.
3. La página, que está preguntando, ve que fue reclamada y empieza a mostrar códigos.

Tres cosas nuevas en el servidor, todas ausentes hoy: una tabla con expiración, una
limpieza periódica, y un límite de intentos sobre el endpoint que reclama.

### 4. Lo que la página web no hace

No muestra el recibo. El recibo del ADR-0034 se lee en el teléfono que estuvo bloqueado,
en persona, y eso no cambia porque la llave sea una pantalla. Una página que mostrara
duraciones ajenas sería el panel remoto que el ADR-0034 descartó, entrando por la puerta
de atrás.

No es una cuenta. La página no inicia sesión, no ve el círculo y no tiene más capacidad
que dibujar un código de una llave que alguien ya emparejó.

### 5. El reloj

El TOTP supone dos relojes parecidos. Entre dos teléfonos la deriva es pequeña; entre un
teléfono y un servidor puede no serlo, y el navegador ni siquiera participa —solo pinta
lo que el servidor le da. La tolerancia de un paso a cada lado del ADR-0034 se mantiene,
y cuando un código válido falla repetidamente la pantalla lo dice en esos términos: el
reloj de este teléfono está corrido, no "código inválido".

## Consecuencias

- El servidor gana su primera ruta pública que devuelve algo que no es JSON, y por lo
  tanto su primera excepción a la puerta de `app.ts:54`. Esa puerta pasa de una cadena de
  `if` a middleware por ruta antes de que eso ocurra.
- Gana su primera tabla con expiración y, con ella, la primera tarea de limpieza.
- Gana su primer límite de intentos. Hoy no hay ninguno en ningún endpoint.
- Necesita dominio, HTTPS y despliegue real. Hoy no hay ninguno de los tres.
- Necesita CORS si la página no se sirve del mismo origen que la API, y con CORS llega la
  primera configuración de origen más allá de `PORT` y `DATABASE_URL`.
- El teléfono necesita el cliente del servidor que el ADR-0033 dejó nombrado y sin
  escribir (`src/platform/circleApi.ts`). La fase 1 no lo necesita; esta sí.
- Un secreto de llave vive ahora también en el servidor, no solo en dos teléfonos. Es la
  primera vez que un secreto que abre algo del usuario está del lado del servidor, y hay
  que decirlo en la política de privacidad y en la ficha.

## Alternativas descartadas

- **Mandar el secreto al navegador y derivar el código en la página.** Funcionaría sin
  red después de la primera carga, y por eso mismo convierte una pestaña olvidada en una
  llave permanente que nadie puede revocar.
- **Que la página verifique y le diga al teléfono que abra o cierre.** Invierte quién
  decide y hace que terminar una sesión dependa de la red. Es exactamente lo que el
  ADR-0033 se cuidó de no romper.
- **Reutilizar el token de cuenta en el navegador.** El token es `id.secreto`, sin
  expiración ni alcance ni revocación. Dárselo a una página es entregar la cuenta entera.
- **Una llave web sin llave de respaldo.** Dejaría a alguien encerrado por una caída de
  internet en otra casa.

## Qué falta decidir antes de implementar

- Si la página se sirve del mismo origen que la API (sin CORS, más simple) o de un
  estático aparte.
- Cuánto vive una sesión de emparejamiento y qué pasa si nadie la reclama.
- Si una llave web se puede revocar desde el teléfono, que es lo que yo recomendaría, y
  cómo se ve esa lista.
