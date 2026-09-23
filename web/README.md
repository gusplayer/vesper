# La página del link de invitación

Lo que decide el ADR-0034: la página que recibe `/join?code=ABC234` cuando alguien
reenvía una invitación del círculo. HTML, CSS y treinta líneas de JavaScript; sin
framework, sin build y sin dependencias.

## Verla en local

```sh
python3 -m http.server 8099 --directory web
# http://localhost:8099/join.html?code=ABC234
```

Con las rutas limpias del despliegue (`/join` en vez de `/join.html`), `npx vercel dev`
desde esta carpeta.

## Desplegada

Vercel, proyecto `vesper`: **https://vesper-azure.vercel.app**
(`/` y `/join?code=…`). Cada `vercel deploy --prod` desde esta carpeta la reemplaza.

La página **no le habla al servidor**: el código viaja en la URL y se queda en el
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
