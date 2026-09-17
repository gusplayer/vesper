# Decisiones de arquitectura

Formato: contexto, decisión, consecuencias. Corto.

Una decisión con más de una opción razonable se documenta antes de implementarse.
Las decisiones no se editan: se marcan como superadas por un ADR nuevo, con una nota al
pie del ADR superado y en esta tabla. ADR-0016 es el pivote: superó en forma las reglas
e-ink; ADR-0026 cerró lo que 0016 había dejado "vigente en su fondo".

| # | Decisión | Estado |
|---|---|---|
| 0001 | Expo con dev client, no Expo Go | aceptada |
| 0002 | Local-first con SQLite, sin backend | aceptada |
| 0003 | El bloqueo se difiere a fase 2 | aceptada en su fondo (el bloqueo no diferencia a Vesper); el bloqueo real se construyó en 0017 (iOS) y 0019 (Android) |
| 0004 | iOS tiene dos superficies de datos que no se reconcilian | aceptada |
| 0005 | Tiempo verificado y declarado nunca se suman | aceptada |
| 0006 | Lenguaje visual de tinta electrónica | superada por 0016 |
| 0007 | No existe pantalla de ajustes | superada por 0016: hay pestaña de Ajustes; sigue sin haber cuenta ni backend |
| 0008 | El hábito tiene nombre propio, no hereda el de una actividad | aceptada |
| 0009 | El swipe es un pager de dos páginas; la sesión es una ruta | superada por 0016 en el pager; la sesión sigue siendo una ruta sin gesto de volver |
| 0010 | El renglón `sin registrar` no suma monedas: resta intervalos | aceptada |
| 0011 | El toque se acusa invirtiendo la caja; el texto tocable lleva regla | superada por 0016 (cerrado en 0026) |
| 0012 | La fase 1 no tiene onboarding: tiene una primera vez | superada en forma por 0026: hay onboarding; la regla 8 (permisos en su flujo, nunca fingidos) sigue |
| 0013 | El cierre del domingo no es una pantalla nueva | superada por 0026: el cierre es el aviso del domingo más Actividad › Semanal; no habrá pantalla |
| 0014 | La sesión activa se ve distinta porque está en tinta | aceptada |
| 0015 | Cuando el timer termina, la sesión se cierra en la misma ruta | superada por 0026: `SessionGate` cierra y abre `session/complete` o `session/closed` (0025), rutas sin vuelta |
| 0016 | El prototipo completo toma la forma de Brick; supera las reglas 1, 2, 3, 5 y 6 de entonces y los ADR 0006, 0007, 0009 | aceptada |
| 0017 | Capacidades reales detrás de una capa de plataforma: persistencia, notificaciones, Salud, Live Activity, bloqueo | aceptada |
| 0018 | Arte de foco: una ilustración puntillista que se dibuja durante la sesión | aceptada |
| 0019 | Las rutinas encienden sesiones (esperan si hay una) y Android bloquea sin AccessibilityService | aceptada |
| 0020 | La app habla el idioma del teléfono: español e inglés, con override en Ajustes | aceptada |
| 0021 | Círculo: comunidad pequeña, silenciosa y opcional; la cuenta vive en el teléfono y el backend llega después | aceptada |
| 0022 | El botón de Focus dice qué hace y se toca; sesiones sin límite; pausas de 15 min que levantan el bloqueo | aceptada; las cifras las fija 0026 (tope 12 h como `expired`, pausa cada 25 min de foco, sin techo a medianoche) |
| 0023 | Las superficies fuera de la app: relojes nativos, pausa distinta, escudo con tinta, notificación de Android como pantalla bloqueada | aceptada |
| 0024 | Sonido y vibración suaves al empezar y terminar la sesión; el interruptor de silencio manda; nada al abrir la app | propuesta (sin implementar) |
| 0025 | Salir de la sesión: la tinta se disuelve en papel; respirar sosteniendo el objeto; la emergencia es una ruta; cierre breve para las canceladas | aceptada |
| 0026 | Cierre de decisiones anteriores: 0011, 0013 y 0015 superados, 0012 superado en forma, 0022 fijado a lo construido, restos de fase 1 borrados | aceptada |
