# ADR-0054 — Las extensiones de Tiempo de uso son código nuestro

**Estado:** aceptada · 2026-09-28. Enmienda el punto 2 del ADR-0052, que decía que `targets/`
no necesitaba configuración propia en el fingerprint.

## Contexto

`targets/` guarda las tres extensiones de Tiempo de uso de iOS: `ActivityMonitorExtension`,
`ShieldAction` y `ShieldConfiguration`. Vienen de las plantillas de
`react-native-device-activity`, y su plugin (`withCopyTargetFolder`) las vuelve a copiar
sobre `targets/` **cada vez que algo evalúa la configuración de Expo**, junto con el
`Shared.swift` del paquete. Eso trae dos problemas.

1. **Un build de iOS se puede caer al azar.** Varias fases del build evalúan la
   configuración al mismo tiempo: "Generate app.config" de `expo-constants`, los
   "[Expo] Configure project" de la app y del widget y, desde ADR-0052, la fase de
   `expo-updates` que calcula el fingerprint. Cada una copia `targets/` encima de la otra, y
   dos copias que se cruzan terminan en `ENOENT: unlink
   targets/ShieldConfiguration/expo-target.config.js`. Pasó el 2026-09-28 al recompilar los
   dev clients: el build falló y el mismo build, repetido sin cambios, pasó. En EAS, un fallo
   así cuesta un build de tienda.
2. **Lo que se escriba a mano en `targets/` se pierde sin aviso.** El ADR-0053 cuenta los
   intentos desde las extensiones del escudo en iOS. Con la copia encendida, esos cambios
   desaparecerían en el siguiente build.

## Decisión

1. **`copyToTargetFolder: false`** en el plugin de `react-native-device-activity`
   (`app.json`). `targets/` ya está en el repositorio y es idéntico a las plantillas de la
   versión instalada (0.6.1). Desde ahora es la fuente de verdad, y nadie lo reescribe.
2. **`targets/` entra en el fingerprint** (`fingerprint.config.js`, `extraSources`). Ya no
   lo cubre la versión del paquete, así que un cambio en su Swift, sus entitlements o su
   `Info.plist` tiene que pedir build. Cuenta también en Android, donde no cambia nada: un
   cambio en una extensión pide build en las dos plataformas.
3. **Actualizar el paquete es un paso explícito:**
   `COPY_TO_TARGET_FOLDER=1 npx expo prebuild --platform ios` trae las plantillas nuevas, y el
   diff se revisa contra lo que hayamos cambiado.

## Consecuencias

- Una evaluación de la configuración ya no escribe en el árbol. Se verificó con
  `@expo/fingerprint`: una línea agregada a `ShieldActionExtension.swift` sobrevive a la
  evaluación y cambia el hash (`c29b421…` a `90f5acb…`). Un cambio en `src/i18n/` no lo mueve.
- La carrera deja de existir por construcción. Que no aparezca en un build no lo prueba;
  que ninguna fase escriba en `targets/` sí.
- El fingerprint de iOS y el de Android cambian una vez con este ADR. Como todavía no hay
  build de tienda, no le cambia nada a nadie.
- Subir `react-native-device-activity` sin el paso 3 deja las extensiones en la versión
  anterior. El build lo compila igual, así que el olvido no se nota solo: el README lo dice
  junto a la instalación.
