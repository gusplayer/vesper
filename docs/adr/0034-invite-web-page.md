# ADR-0034 — La página que recibe un link de invitación

**Estado:** aceptada · 2026-09-23

## Contexto

El ADR-0021 dejó esto escrito al decidir cómo se invita: el link es solo transporte del
código, hoy `vesper://circle/join?code=ABC234`, y "un link `https` universal cuando haya
dominio, con el mismo código adentro". Ese dominio nunca existió, así que el link que
sale por la hoja de compartir solo funciona en un teléfono que ya tiene Vesper
instalada. Reenviado a cualquier otro, no abre nada: ni una explicación, ni la tienda.

Con el servidor del ADR-0033 ya desplegado y el ADR-0032 esperando retos abiertos que se
reparten precisamente por link, el agujero pasa de incómodo a bloqueante: un reto abierto
es un link que le mandas a alguien que **todavía no tiene la app**.

El dueño del producto pidió además poder ver "la web" en local. No existe ninguna: la app
es React Native con dev client y módulos nativos (op-sqlite, Screen Time, el bloqueo en
Kotlin, la Live Activity), y el servidor solo habla JSON. Esta es la primera superficie
web de Vesper, y conviene que sea la más pequeña que resuelve algo real.

## Decisión

Una página estática, sin framework y sin build, en `web/`, desplegada en Vercel.

### Qué hace

- **`/join?code=ABC234`**: dice que te invitaron a un círculo, muestra el código en
  grande —para escribirlo a mano en la app, que ya tiene ese campo— y ofrece **Abrir
  Vesper**, que salta a `vesper://circle/join?code=ABC234`. Debajo, qué es un círculo en
  tres líneas y qué hacer si no tienes la app.
- **`/`**: qué es Vesper, corto, con la marca. Es la cara del dominio, no una landing de
  campaña.
- Sigue el idioma del teléfono (`navigator.language`), español o inglés, con la misma voz
  de la app (ADR-0020).
- Se ve como la app: tinta `#1C1B1A` sobre `#E8E6E2`, Outfit, la grilla 4×4 de la marca
  dibujada con celdas. Sin ilustraciones nuevas.

### Qué no hace, y es lo importante

- **No le habla al servidor.** El código viaja en la URL y se queda en el navegador. La
  página no valida si existe, no dice de quién es y no aprende nada de quien la abre: si
  validara, un desconocido con un código podría averiguar el nombre de su dueño.
- **Sin analítica, sin cookies, sin píxeles.** Nada que perseguir a nadie.
- **No es un panel.** El servidor no gana una cara administrativa por esta puerta.

### Links universales: todavía no

Un link `https` que abra la app directamente necesita
`/.well-known/apple-app-site-association` con el Team ID de la cuenta de Apple y
`/.well-known/assetlinks.json` con la huella SHA-256 del certificado de firma de Android.
No tenemos ninguno de los dos, y **no se publica un archivo con datos inventados**: la
página abre el esquema propio (`vesper://`), que funciona hoy en un teléfono con la app.
Cuando existan las credenciales se agregan los dos archivos y el mismo link empieza a
abrir la app sin pasar por la página. El código adentro no cambia.

### Dominio

Por ahora el que da Vercel. Cuando haya dominio propio se apunta ahí y los links que ya
salieron siguen sirviendo, porque lo que importa es el código, no el host.

## Consecuencias

- Una carpeta nueva, `web/`, fuera del bundle (Metro la bloquea como a `server/`) y sin
  dependencias: HTML, CSS y treinta líneas de JavaScript.
- La invitación deja de morir cuando se reenvía a alguien sin la app.
- Queda pendiente: los dos archivos de links universales, los links a las tiendas cuando
  la app se publique, y `/reto?code=` cuando el ADR-0032 defina el reto abierto.
