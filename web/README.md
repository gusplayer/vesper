# El sitio de Vesper

Dos cosas, el mismo HTML plano: la página que recibe `/join?code=ABC234` cuando alguien
reenvía una invitación del círculo (ADR-0034), y los textos que la app tiene que poder
enlazar —Términos y Privacidad (ADR-0046)—. Sin framework, sin build y sin dependencias.

## Verla en local

```sh
python3 -m http.server 8099 --directory web
# http://localhost:8099/join.html?code=ABC234
# http://localhost:8099/terms.html   ·   /privacy.html   (añade ?lang=en para el inglés)
```

Con las rutas limpias del despliegue (`/join` en vez de `/join.html`), `npx vercel dev`
desde esta carpeta.

## Desplegada

Vercel, proyecto `vesper`: **https://vesper-azure.vercel.app**
(`/`, `/join?code=…`, `/terms` y `/privacy`, con `/terminos` y `/privacidad` sirviendo las
mismas dos páginas en español). Cada `vercel deploy --prod` desde esta carpeta la
reemplaza. Las rutas sin `.html` salen de `cleanUrls` y de los `rewrites` de
`vercel.json`: en local, `npx vercel dev`.

La de invitación **no le habla al servidor**: el código viaja en la URL y se queda en el
navegador. Validarlo contra la API le diría a un desconocido de quién es ese código.

Tampoco le habla a nadie más. La fuente Outfit se sirve desde este mismo dominio
(`fonts/`, tres pesos copiados de `@expo-google-fonts/outfit`, licencia SIL OFL en
`fonts/OFL.txt`) en vez de `fonts.googleapis.com`, que es lo que hacía falsa la frase del
pie: cada visita le anunciaba a un tercero la dirección y el navegador de quien abrió el
link antes de que leyera una palabra. El `Content-Security-Policy` de `vercel.json` lo
sostiene: `default-src 'none'`, y `'self'` para el estilo, la fuente y el script. Si
alguna vez la página carga algo de afuera, el navegador lo bloquea y la consola lo dice.

Pendiente: `/.well-known/apple-app-site-association` y `/.well-known/assetlinks.json`
para que el link abra la app sin pasar por aquí. Necesitan el Team ID de Apple y la
huella SHA-256 del certificado de firma de Android, que todavía no existen.

## Términos y Privacidad (borradores)

`terms.html` (`/terms`, `/terminos`) y `privacy.html` (`/privacy`, `/privacidad`) son lo
que decide el ADR-0046: los textos viven aquí, no dentro de la app, porque una tienda
pide una URL y una política cambia sin publicar una versión nueva. La app enlaza desde
Ajustes › Acerca de.

**Estos textos no son un dictamen legal.** Los escribió quien conoce el código, leyendo
el código: describen lo que la app hace hoy —lo local, el permiso de uso y sus dos
propósitos, Salud y Health Connect en solo lectura, y lo que el círculo sube métrica por
métrica según los tres interruptores— y nada más. **No se publican como definitivos sin
que alguien con criterio legal los lea.** Mientras tanto van marcados con un comentario
de borrador en el `<head>` de cada página.

Antes de publicarlos hace falta:

- `[TITULAR]`: quién responde por la app (solo en Términos).
- `[CONTACTO]`: el correo al que se escribe, en las dos páginas.
- La fecha de vigencia y la ley aplicable, que Términos hoy no nombra.
- La revisión legal de arriba.

Cada vez que cambie qué sale del teléfono, las dos páginas cambian en el mismo commit.
Play las exige en la ficha y en la declaración de Health Connect
(`docs/PLAY_DECLARATIONS.md` §f), y Health Connect muestra el link de privacidad en su
hoja de permisos.

### Los dos idiomas

Las dos páginas traen español e inglés en el HTML y `legal.js` esconde el que no se pidió:
`?lang=es|en` si el link lo trae —lo que se le manda a una tienda o a un abogado—, luego
la ruta en español (`/privacidad`, `/terminos`), y si no, el idioma del navegador, como
`invite.js`. Sin JavaScript se ven los dos, que para un texto legal es mejor que ver
medio. Abajo de todo hay un enlace para cambiar de idioma. No se guarda nada: ni cookie,
ni `localStorage`, ni una petición.
