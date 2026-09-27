# ADR-0052 — Actualizaciones por el aire con EAS Update

**Estado:** aceptada · 2026-09-27. Enmienda la regla 7 de `CLAUDE.md`: se suma una cuarta
cosa que sale del teléfono, la consulta de si hay una actualización, que no lleva datos del
usuario.

## Contexto

Casi todo lo que cambia de una tanda a otra es JS: pantallas, dominio, textos, stores,
migraciones y la lógica de `src/platform/`. Hoy cada uno de esos cambios pide un build, una
subida y una revisión de App Store y de Play. `expo-updates` descarga un bundle nuevo y lo
aplica en el siguiente arranque, sin pasar por la tienda.

Una actualización solo llega a un binario que ya trae `expo-updates`. La app todavía no
salió a TestFlight ni a Play, así que el primer build de tienda es el momento de meterlo: un
binario que sale sin él nunca va a recibir una.

El precio es de privacidad. Al arrancar, `expo-updates` le pregunta al servidor de
actualizaciones si hay algo nuevo, y esa consulta no está entre lo que la regla 7 deja salir.
Leído en el código de SDK 57 (`FileDownloader.swift` y `FileDownloader.kt`), la consulta
lleva:

- la plataforma, la versión de runtime y el canal;
- el id de la actualización que corre y el de la que viene dentro del binario;
- `EAS-Client-ID`: un UUID al azar que `expo-eas-client` crea en la primera consulta y guarda
  en `UserDefaults` o `SharedPreferences`. No tiene relación con la identidad de Vesper y
  nunca llega a nuestro servidor;
- **solo si la app se cayó en los diez segundos siguientes a abrir**, el texto de ese error,
  cortado a 1024 caracteres (`Expo-Fatal-Error`), en la consulta siguiente;
- la IP, como cualquier petición.

Nada de la base de datos ni de la identidad viaja en esa consulta.

## Decisión

1. **EAS Update**, con `expo-updates` en el binario desde el primer build de tienda. Queda
   descartado por ahora un servidor propio en Railway. El protocolo es abierto, pero habría
   que servir los bundles, firmarlos y manejar los canales, y hoy nada de eso nos da algo
   que EAS no dé. Pasarse después exige un build, porque la URL vive en el binario.

2. **`runtimeVersion` con la política `fingerprint`.** El runtime es un hash de todo lo
   nativo: dependencias y sus versiones, plugins, `app.json`, `patches/` y los módulos
   locales de `modules/`. Una actualización solo le llega a un binario con el mismo hash, así
   que un cambio de JS nunca cae sobre código nativo que no lo soporta. Se verificó en el
   worktree: un comentario en `src/widgets/FocusActivity.tsx` y otro en `src/i18n/` dejan
   el hash igual, y uno en `modules/vesper-identity/ios/` lo cambia. `targets/` no necesita
   configuración propia: el plugin de `react-native-device-activity` lo reescribe desde sus
   plantillas cada vez que evalúa la configuración, y la versión del paquete ya entra en el
   hash.

3. **Dos canales**, `preview` y `production`, uno por perfil de `eas.json`. Los builds de
   desarrollo no tienen canal: cargan de Metro, y una actualización se prueba en ellos desde
   la pestaña Extensions del dev client.

4. **Consultar al abrir y nunca esperar**: `checkAutomatically: ON_LOAD` y
   `fallbackToCacheTimeout: 0`. La app abre con lo que tiene. Si hay algo nuevo, se descarga
   en segundo plano y se aplica en el siguiente arranque en frío. Sin red no cambia nada
   (regla 7). **La app nunca llama a `reloadAsync()`**: una actualización no reinicia una
   sesión en curso ni aparece como aviso.

5. **Qué puede viajar por el aire.** Todo `src/`, las migraciones (son JS), imágenes y
   fuentes, y el layout de la Live Activity, que Babel convierte en texto dentro del bundle.
   Lo nativo pide build, y el fingerprint lo hace cumplir solo: los módulos locales,
   `targets/`, `patches/`, los permisos y textos de `Info.plist`, los plugins y cualquier
   dependencia nativa nueva. Tampoco viaja nada que cambie el propósito de la app ni una
   función que la revisión no vio: lo que pide un permiso nuevo pide build de todas formas.

6. **Migraciones: siempre hacia adelante.** Una actualización que trae una migración solo
   agrega: tablas nuevas y columnas que aceptan nulo o traen default. No se hace rollback de
   una actualización que ya aplicó una migración: el código anterior correría sobre un
   esquema que no conoce. Si algo falla, se corrige con una actualización nueva.

7. **Lo que sale se dice por escrito, en la misma tanda** (ADR-0046). La privacidad nombra
   la consulta, el id de instalación, el texto del error y la IP. `docs/APP_REVIEW.md` y
   `docs/PLAY_DECLARATIONS.md` los declaran. Expo ya procesa datos por encargo de Vesper
   para los avisos; ahora también para las actualizaciones.

## Consecuencias

- Un arreglo o una mejora de JS llega en minutos:
  `eas update --channel production --message "…"`. Llega a quien abra la app, en el
  arranque siguiente, sin revisión.
- Un cambio nativo sigue pidiendo build y revisión. El fingerprint impide mandarlo por el
  aire por error: la actualización queda en un runtime que ningún binario tiene. Antes de
  publicar, `npx expo-updates fingerprint:generate` dice si el runtime cambió frente al del
  build de tienda.
- `ios/` y `android/` se regeneran con `expo-updates` adentro: los dev clients instalados
  hay que compilarlos de nuevo.
- La versión que ve nuestro servidor (ADR-0048) es la del binario. Qué actualización corre
  lo sabe EAS, no nosotros.
- Vesper pasa a mandar un texto de error cuando se cae al abrir, y eso se declara como
  diagnóstico. Apagarlo sin tocar el código nativo no se puede. Pisar el header con
  `requestHeaders` lo mandaría vacío en cada consulta, y no se sabe qué hace EAS con eso.
- Firmar las actualizaciones (`codeSigningCertificate`) queda para después. Hoy las
  protege el HTTPS de EAS y la cuenta del proyecto.
- EAS Update cobra por usuarios activos al mes por encima del plan gratuito. Hay que
  revisar el límite antes de que la app tenga tráfico real.
