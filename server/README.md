# El servidor del círculo

Lo que decide el ADR-0033: cuentas por dispositivo, sincronía de filas con dueño y
entrega por Expo push. No entra al bundle de la app (`metro.config.js` bloquea esta
carpeta) y se despliega solo.

## Correrlo en local

```sh
npm install
npm run dev          # sin DATABASE_URL: todo en memoria, los push se registran y no salen
npm test             # 16 tests sobre las reglas de dueño y de cursor
npm run typecheck
```

Con `DATABASE_URL` apuntando a un Postgres, `npm start` aplica `src/schema.sql` al
arrancar (`create table if not exists`, así que correrlo dos veces no rompe nada) y los
push salen de verdad por Expo.

## Dónde está desplegado

- **Railway**, proyecto `vesper`, servicio `circle-api`, entorno `production`.
  Raíz del build `/server`, arranque `npm start`, healthcheck `/health`.
  Se redespliega solo con cada push a `main`.
- **Neon**, proyecto `vesper` (`snowy-lake-14790843`), región `aws-us-east-1`,
  base `neondb`.
- **URL**: `https://circle-api-production.up.railway.app`

`DATABASE_URL` vive en las variables del servicio en Railway y **no se guarda en el
repositorio**. Si hay que rotarla, se saca de la consola de Neon y se pone ahí.

## La API, en corto

Todo menos `POST /account` y `GET /health` necesita
`Authorization: Bearer <id>.<secreto>`.

| Verbo | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Responde `{"ok":true}`. Es el healthcheck de Railway. |
| POST | `/account` | Crea la cuenta (el teléfono elige el id; el servidor entrega el secreto **una sola vez**) o actualiza nombre, alias y código de invitación. |
| DELETE | `/account` | Borra la cuenta y todas sus filas. |
| POST | `/device` | Token de push, zona horaria e interruptor de empujones. |
| POST | `/invite/redeem` | Usa el código de otra persona: queda pendiente de que acepte. |
| POST | `/invite/accept` | Acepta a quien usó tu código; el vínculo queda en los dos sentidos. |
| POST | `/challenge/join` | Entra a un reto de alguien de tu círculo. |
| POST | `/sync` | Sube lo que el llamante posee y baja lo que cambió en su círculo desde `since`. Devuelve `now` como próximo cursor y `rejected` con lo que no pasó las reglas. |

En `weeks`, **null es "no lo comparte"**, nunca cero: cero diría que esa persona no hizo
nada esa semana, que es otra cosa. Los tres interruptores de Ajustes › Círculo (foco,
hábitos, uso de redes) llegan aquí como nulls.

Cada escritura se fuerza al llamante: una semana es suya, una marca es suya, el ánimo y
el empujón salen de él. Nada confía en un id que venga en el cuerpo.

## Verificar un despliegue

```sh
curl -s https://circle-api-production.up.railway.app/health
```

Y el flujo entero (dos cuentas, código, aceptación, semana, reto, marca, empujón) está
en los tests; para correrlo contra un servidor de verdad basta con repetir esas llamadas
con `curl` cambiando la URL.
