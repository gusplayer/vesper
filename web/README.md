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

Pendiente: `/.well-known/apple-app-site-association` y `/.well-known/assetlinks.json`
para que el link abra la app sin pasar por aquí. Necesitan el Team ID de Apple y la
huella SHA-256 del certificado de firma de Android, que todavía no existen.
