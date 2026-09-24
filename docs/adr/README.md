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
| 0027 | Racha diaria con días de gracia, empujones del círculo y avisos que traen de vuelta; silencio absoluto en sesión | aceptada |
| 0028 | Abrir la app: el splash es una hoja de tinta y `BootReveal` la disuelve de los bordes al centro hasta dejar la marca, que se funde con la app | aceptada |
| 0029 | Uso por app como lectura efímera detrás de `platform/usage`, un solo `AppTile` (icono real en Android, cuadro con inicial en iOS) y desglose bajo "redes" en Actividad › Hoy; sin logos de marca dibujados a mano | aceptada |
| 0030 | Compartir un momento cerrado (sesión completa; luego la semana) como una tarjeta 9:16 en tinta hecha en el teléfono, con vista previa y hoja del sistema; gesto secundario, tres cosas, marca sin URL, nada de apps, redes ni círculo en la imagen | propuesta |
| 0031 | Retos que valen la pena abrir: `challengeRisk` en el dominio, aviso local de reto en riesgo y de cierre dentro del presupuesto de ADR-0027, la semana del reto dibujada como la grilla de Focus, cierre con "Repetir", el reto visible en Hábitos, Actividad y Focus, y retos sugeridos propios | aceptada |
| 0032 | Retos públicos: sí, como reto abierto por link (sin directorio, sin lista de participantes, empujón solo del círculo) y como retos destacados curados por nosotros; exige el ADR del backend, alias únicos, reporte y bloqueo | propuesta |
| 0033 | El servidor del círculo: cuenta por dispositivo (id + secreto en el llavero, sin correo), alias únicos, un `POST /sync` con cursor sobre `updated_at` donde cada fila tiene dueño, entrega por Expo push de lo que otra persona hizo, y borrado de cuenta; Hono sobre Postgres en `server/`, fuera del bundle | aceptada |
| 0034 | La página que recibe un link de invitación: estática, sin framework, en Vercel; muestra el código, salta a `vesper://circle/join?code=…` y no le habla al servidor (validarlo revelaría de quién es); los links universales esperan Team ID y huella de firma | aceptada |
| 0035 | Qué mide la fila "redes": solo las selecciones de los modos `block` (un modo `allow` no se puede invertir sin enumerar el teléfono), y el piso de demostración nunca se comparte al círculo — el interruptor decide si se comparte, el origen decide si hay algo que compartir | aceptada |
| 0036 | La marca de una ventana de rutina es por rutina, no una sola global: con dos rutinas solapadas la segunda le robaba la marca a la primera y le arrancaba una sesión de horas con el bloqueo puesto (migración 008) | aceptada |
| 0037 | Un empujón del círculo viaja como push silencioso y la notificación la compone el teléfono, bajo el presupuesto de ADR-0027 y con silencio absoluto en sesión; corrige lo que ADR-0033 daba por escrito | propuesta |
| 0038 | Actividad › Hoy dibuja `buildLedger` en vez de restar a mano: el residuo vuelve a ser el complemento de una unión y el estimado sale de la resta (ADR-0010). Las filas de Salud esperan a que la semana leída viva en un store efímero | aceptada |
| 0039 | La gracia sostiene la cadena, no suma un día (enmienda a 0027) | aceptada |
| 0040 | Dos avisos son dos momentos, no un zumbido (enmienda a 0027) | aceptada |
| 0041 | Un hábito verificado que nada puede verificar cae a declarado, y lo dice | aceptada |
| 0042 | Retos de pasos: la meta va en el nombre (`stepGoalFor`, como el sueño), unirse pide Salud y es el consentimiento, el círculo ve días y nunca pasos, y cada marca dice si vino de Salud, de una sesión o de la mano (migración 009) | aceptada |
| 0043 | Salud en Android es Health Connect, leído por un módulo Kotlin propio (`modules/vesper-health`, solo `connect-client`); `health.ts` se parte en `.ios`/`.android` con la misma superficie; sin Health Connect en Android 9–13 el botón lo instala desde Play; `minSdk` 26 | aceptada |
