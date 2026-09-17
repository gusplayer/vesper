# ADR-0021 — Círculo: comunidad pequeña, silenciosa y opcional

**Estado:** aceptada · 2026-09-15

## Contexto

Vesper existe para que la gente esté presente en el mundo real y comparta con quien más
quiere. Las metas en compañía se cumplen más que las metas a solas, y la evidencia es
vieja: un compañero de gimnasio, un club de lectura, alguien a quien contarle que hoy no
tocaste el teléfono. El dueño del producto pidió una capa de comunidad con estas piezas:
cuenta, invitar o ser invitado, compararse con otros (foco, redes), dar ánimo, y hacer
rutinas juntos como retos donde se ve quién cumplió y quién no.

El riesgo es obvio. Una capa social mal hecha es exactamente lo que Vesper combate: un
feed, notificaciones, contadores de seguidores, rankings, el teléfono pidiendo atención.
El PRD dejó "rachas, badges, leaderboards, social" fuera de la v1 por eso.

Además hay tres reglas duras que tocan esto:

- Regla 7 y ADR-0002: local-first, sin backend. Una comunidad necesita, tarde o temprano,
  un servidor.
- Regla 4: máximo 5 hábitos. Un reto compartido es un hábito con testigos.
- Regla 9 y ADR-0005: lo verificado, lo declarado y lo estimado nunca se suman. Comparar
  "redes" entre personas es comparar estimaciones.

Las opciones:

1. **Red social clásica**: perfiles públicos, seguir y ser seguido, feed, likes. Es lo que
   más engancha y lo que más contradice el producto.
2. **Nada social.** Coherente con el PRD original, pero deja fuera el mecanismo más
   probado para sostener un hábito: otra persona.
3. **Un círculo**: un grupo pequeño de personas que eliges, sin feed, sin seguidores, sin
   ranking, sin notificaciones. Se ve una vez por semana, cuando abres Actividad. Lo que
   se comparte lo decides tú, métrica por métrica.

## Decisión

Opción 3. La capa se llama **Círculo** (en inglés, *Circle*) y obedece cinco principios:

1. **Personas, no seguidores.** Invitas o te invitan; no se sigue a nadie. Un círculo tiene
   hasta 12 personas (`MAX_CIRCLE`). No hay perfiles públicos ni búsqueda de gente.
2. **Silencio.** El círculo no genera notificaciones. Nunca. Ni un kudo, ni un reto, ni
   una invitación. Se ve cuando abres la app, en Actividad.
3. **Sin ranking.** La comparación semanal ordena por horas de foco y nada más: sin
   posiciones, sin medallas, sin porcentajes contra el grupo. Un reto muestra quién
   cumplió y quién no, con una marca y una raya, no con puntos.
4. **Tú decides qué se ve.** Tres interruptores en Ajustes › Círculo: horas de foco (por
   defecto sí), hábitos y retos (por defecto sí), uso estimado de redes (por defecto no).
   Lo que no compartes no sale del teléfono, y lo que ve el otro lleva su origen: el uso
   de redes se muestra siempre como piso estimado, en su propia línea, nunca sumado
   (ADR-0005).
5. **Kudos, no likes.** "Dar ánimo" es un gesto de una persona a otra, una vez por día,
   sin contador público. Quien lo recibe ve una línea: "Ana y Luis te dieron ánimo esta
   semana". No hay quién dio más.

### Retos

Un reto es un hábito con testigos: nombre, veces por semana, una duración de 1, 2 o 4
semanas y quiénes participan. Cuando te unes, el reto se vincula a un hábito tuyo con
ese nombre (se crea si no existe, y **sigue contando contra el máximo de 5**: si no hay
lugar, la pantalla lo dice y no crea nada). Tus marcas son tus marcas de hábito de
siempre; las de los demás llegan como `challenge_marks`. Cada semana se ve, por persona,
cuántas veces de las prometidas, y al cierre quién cumplió. Sin premio.

### Dónde vive en la UI

No hay quinta pestaña. El círculo aparece en tres lugares:

- **Actividad › Semanal**, al final, una sección "Tu círculo": hasta cuatro personas con
  sus horas de la semana y el botón de ánimo, y "Ver círculo ›". Sin círculo, una tarjeta
  quieta que invita.
- **`circle/`**: la pantalla del círculo (semana, retos, invitar), la de invitaciones
  (tu código, un campo para el código de otro, invitaciones pendientes), y las de reto
  (detalle y nuevo).
- **Ajustes › Círculo**: tu perfil (nombre y alias), qué compartes, salir del círculo.

Al terminar una sesión, si alguien te dio ánimo esta semana, el cierre lo dice en una
línea pequeña. Es el único lugar fuera de Actividad y es texto, no un aviso.

### Arquitectura: la cuenta vive en el teléfono, el servidor llega después

Esta ronda **no agrega backend**. Se construye la capa completa de datos y UI sobre
SQLite, con la misma forma que tendrá cuando exista un servidor:

- **Migración 004**: `circle_members`, `member_weeks`, `kudos`, `challenges`,
  `challenge_marks`. El perfil propio y las preferencias de compartir son claves JSON en
  `settings` (`circle_profile`, `circle_share`). Ver `docs/DATA_MODEL.md`.
- **`member_weeks` es lo que un servidor entregaría**: por persona y semana, foco,
  redes (o null si no lo comparte), hábitos hechos y prometidos. La UI deriva de ahí; no
  hay otro camino. Cuando llegue el sync, escribe esa tabla y nada más cambia.
- **`src/platform/circle.ts`** expone `status()` como el resto de la capa de plataforma
  (ADR-0017): hoy `available: false` con la razón "todavía no hay conexión con otros
  teléfonos". Las pantallas lo dicen en una línea. Nada se presenta como real.
- **Identidad local.** "Crear tu perfil" guarda nombre y alias en este teléfono. No hay
  correo, contraseña ni proveedor de identidad: eso lo decide el ADR del backend,
  cuando el círculo haya demostrado que vale la pena. Los ids son UUID v7, como todo.
- **Datos de demostración.** Cuatro personas, dos semanas de números, un reto activo,
  dos kudos y una invitación pendiente se siembran con el resto del demo y se borran con
  "Borrar todo y reiniciar". El perfil propio **no** se siembra: crearlo es parte del
  flujo.

Se descartó sumar Supabase o Convex ahora: la pregunta de producto ("¿alguien invita a
alguien?") se contesta con el prototipo, y el backend correcto depende de cómo se use.
El costo de esperar es una tabla que hoy se llena desde el seed y mañana desde la red.

## Consecuencias

- El PRD cambia: "social" deja de estar fuera de alcance; lo que sigue fuera son feed,
  seguidores, ranking, notificaciones sociales y gamificación.
- Cinco tablas nuevas, una área nueva de strings (`circle`) en los dos idiomas, un
  componente nuevo (`Avatar`) y cinco pantallas. Sin dependencias nuevas.
- Un reto ocupa un hábito. Es la regla 4 aplicada, no una excepción.
- Lo que un usuario ve de otro es siempre lo que el otro eligió compartir, con su
  procedencia. La comparación de redes es entre estimaciones y se dice.
- Queda pendiente para un ADR posterior: el backend, la identidad real, el sync de
  `member_weeks`, y qué pasa con los datos de alguien que sale del círculo.

## Adenda 2026-09-16 — link, QR y el código como solicitud

Tres ajustes a la invitación, después de ver la primera versión:

- **El código es una solicitud, no una llave.** Quien usa tu código (o tu link) queda
  como "pendiente" de tu lado y tú aceptas, igual que una invitación recibida. Así un
  link reenviado no mete a un desconocido en tu círculo. "Generar código nuevo" sube
  `codeGeneration` en el perfil y el código anterior deja de coincidir; quien ya está,
  se queda.
- **El link es solo transporte del código.** `vesper://circle/join?code=ABC234` hoy;
  un link `https` universal cuando haya dominio, con el mismo código adentro. Compartir
  envía texto con el código y el link. El link cae en `circle/join`, que pide entrar con
  un toque, o manda a crear el perfil primero.
- **El QR codifica ese link.** La cámara nativa del teléfono lo abre en Vesper, así que
  no hay escáner dentro de la app ni permiso de cámara. El codificador es propio
  (`src/lib/qr.ts`: byte, nivel M, versiones 1 a 5) y se dibuja con `react-native-svg`,
  que ya estaba; sin dependencia nueva. Se verificó decodificando su salida con Vision
  de macOS en las cinco versiones, y sus patrones de función coinciden módulo a módulo
  con `CIQRCodeGenerator`.
- En la pantalla, el código ajeno vive en su propia sección ("¿Te dieron un código?")
  para que no se lea como un segundo código propio.

