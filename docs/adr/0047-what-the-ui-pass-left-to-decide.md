# ADR-0047 — Lo que la pasada de UI dejó para decidir

**Estado:** aceptada · 2026-09-25 (el dueño del producto decidió los trece puntos; ver "Decisión" al final). Supera ADR-0026 §7 en lo que toca a las rutinas sembradas.

## Contexto

La pasada de UI/UX del 2026-09-24 auditó las 45 rutas con siete revisiones (una por área y
una transversal; los reportes quedaron fuera del repo). Todo lo que las reglas y los ADR
vigentes ya resolvían se implementó en la misma tanda. Lo que sigue tiene más de una opción
razonable, o contradice un ADR aceptado, así que cada punto necesita un sí o un no antes de
tocar código. Cada uno trae la recomendación de la revisión.

## Decisiones pendientes

### 1. Los datos de ejemplo

**Hoy:** la base se siembra una vez con ~70 días de sesiones, hábitos, un círculo, una fecha
de nacimiento (ya quitada en esta tanda) y **tres rutinas encendidas**. ADR-0026 §7 las sella al
terminar el onboarding, así que el siguiente día hábil a las 9:00 "Trabajo" arranca una sesión
**profunda** de hasta 9 h en un modo que el usuario nunca creó. "Borrar todo y reiniciar" vuelve
a sembrar lo mismo, y Acerca de promete que los datos se pueden borrar.

**Opciones:** (a) sin datos de ejemplo; (b) una elección al final del onboarding, "Empezar con
ejemplos" / "Empezar vacío"; (c) se quedan, pero las rutinas de ejemplo se siembran apagadas,
Focus y Actividad dicen "datos de ejemplo" hasta la primera sesión real, Ajustes gana "Quitar los
datos de ejemplo" (borra solo lo sembrado) y "Borrar todo" termina vacío.

**Recomendación:** (c). Supera ADR-0026 §7 en lo que toca a las rutinas sembradas.

### 2. Una sola lista de apps por modo

**Hoy:** un modo guarda dos listas. El catálogo de demostración (`appIds`, `websiteIds`) es lo
que cuentan todos los resúmenes ("Bloquea 4 apps · 3 sitios"), y la selección real
(`selectionToken`) es lo único que se bloquea. Los modos sembrados, los de Ideas y los sitios no
bloquean nada en ninguna plataforma. Esta tanda lo dice en pantalla, pero no lo resuelve.

**Opciones:** (a) donde el teléfono puede bloquear (o se le puede dar el acceso), "Apps" *es* el
selector real y el catálogo desaparece; el catálogo queda solo donde no hay selector real, con la
etiqueta de ejemplo; en Android desaparece "Sitios" y en iOS los sitios salen del selector de
Tiempo de uso; (b) dejar las dos listas con sus avisos.

**Recomendación:** (a).

### 3. Los caminos que se saltan lo que promete "profundo"

- (a) El play de una rutina manual arranca una sesión profunda con un toque, sin mantener.
  Propuesta: con un modo profundo, el play lleva a Focus con el modo y la duración listos, y ahí
  se mantiene el botón.
- (b) Al terminar cualquier sesión, incluso con un desbloqueo de emergencia, una rutina que
  esperaba arranca en el acto y vuelve a encerrar al usuario. Propuesta: una sesión que el
  usuario termina por decisión (salida o emergencia) marca como empezadas las ventanas abiertas
  en ese momento, como ADR-0019 ya hace con la ventana de la propia rutina.
- (c) "Hasta que lo termines" en una rutina es una sesión planeada de 8 h, y con profundo no se
  puede terminar. Esta tanda cambió el texto a "Sin hora de fin · hasta 8 h". Propuesta: que esa
  ventana arranque como sesión abierta, y que profundo corra como firme, igual que "Sin límite"
  (ADR-0022).

**Recomendación:** las tres.

### 4. Un solo "promedio" en Actividad

Semanal cuenta los días sin foco como cero; Mensual los salta; las dos usan la misma pastilla
"PROM". **Recomendación:** los dos sobre los días transcurridos, con ceros, como el semanal.

### 5. Terminar un vínculo en el servidor del círculo

Rechazar, Quitar, Salir del círculo y Salir del reto (de uno ajeno) solo cambian este teléfono:
el servidor no tiene una llamada que corte el vínculo, y la otra persona sigue viéndote. Esta
tanda hace que las confirmaciones digan lo que pasa de verdad. **Recomendación:** enmendar
ADR-0033/0044 con un `POST /link/end` (o equivalente) que usen las cuatro acciones.

### 6. Los interruptores de Mis reglas que no llegan al sistema

Modo estricto, instalaciones y compras no hacen nada en ninguna plataforma (el filtro de adulto
solo en iOS). Esta tanda lo dice en cada tarjeta. **Opciones:** (a) quitarlos hasta que existan;
(b) dejarlos con la nota. **Recomendación:** (a) para modo estricto (nunca se implementó); (b)
para los demás mientras se decide la fase de bloqueo en iOS.

### 7. Dónde viven los hábitos en Actividad

Marcar un hábito hoy es una acción diaria y vive al fondo de "De por vida". **Recomendación:**
una sección "Hábitos esta semana" en la vista Semanal; "De por vida" guarda el resumen.

### 8. El salvavidas fuera de profundo

En suave y firme hay una salida gratis (respirar); el salvavidas cuesta uno de los cinco del mes.
Esta tanda agrega una línea que lo dice. **Opción:** esconder el salvavidas fuera de profundo
(cambia ADR-0025 §4). **Recomendación:** dejarlo con la línea.

### 9. La sesión que venció con la app cerrada

Hoy se cierra en silencio al arrancar. **Recomendación:** mostrar `session/complete` una vez, la
próxima vez que se abre la app.

### 10. La intención de la sesión

El PRD la lista y `session/complete` tiene la fila, pero ninguna pantalla deja escribirla.
**Opciones:** (a) un campo opcional en la hoja de duración de Focus; (b) sacarla del PRD.
**Recomendación:** (a).

### 11. El indicador de la barra de pestañas

Se desliza (`translateX`), y la regla 6 dice que solo se anima la opacidad. **Opciones:**
(a) que se funda en vez de deslizarse; (b) enmendar la regla 6 para nombrarlo.
**Recomendación:** (a).

### 12. El arte de una sesión sin límite

Se dibuja al ritmo del tope de 12 h, así que en una hora va al 8 %. **Recomendación:** que una
sesión abierta dibuje al ritmo de 2 h y se complete ahí.

### 13. Lo que es del dueño, no del código

- Un correo de contacto: Ayuda, `web/terms.html` y `web/privacy.html` lo necesitan.
- Desplegar `web/` (hoy `/terms` y `/privacy` dan 404, y la app y el onboarding enlazan ahí).
- Revisar y firmar `web/privacy.html` y `web/terms.html`.

## Consecuencias

Mientras un punto no se decide, la app hace lo que hacía, pero lo dice en pantalla (regla 8).
Cada punto aceptado se implementa en su propia tanda, y este ADR se marca aceptado o superado
por punto en `docs/adr/README.md`.

## Decisión (2026-09-25)

El dueño del producto aceptó las recomendaciones, con una precisión sobre el punto 1.

1. **Datos de ejemplo: la opción (c).**
   - Las tres rutinas de ejemplo se siembran **apagadas**.
   - Mientras quede algún dato sembrado, Focus y Actividad lo dicen en una línea:
     "Incluye datos de ejemplo. Quítalos en Ajustes."
   - Ajustes gana **"Quitar los datos de ejemplo"**, con confirmación. Borra solo lo
     sembrado (las sesiones `demo-`, los modos, rutinas y hábitos de ejemplo con sus marcas,
     y el círculo de ejemplo) y deja todo lo del usuario. Solo aparece mientras queda algo.
   - **"Borrar todo y reiniciar" termina vacío**: los datos de ejemplo se siembran una sola
     vez, en la primera instalación, nunca después de un reinicio.
   - **Precisión del dueño:** no toda rutina, todo modo ni todo reto tiene que bloquear
     apps. Una rutina de gym con las redes abiertas es una elección, no un error. Un modo
     sin apps bloqueadas se dice como un hecho neutro ("No bloquea apps"), nunca en tono de
     peligro ni con un imperativo ("elige sus apps"). Agregar apps sigue estando en el
     editor del modo, para quien quiera.
2. **Una sola lista de apps por modo: la opción (a), porque es la más simple de entender.**
   Donde el teléfono puede bloquear, o se le puede dar el acceso desde la app, la fila
   "Apps" del modo **es** el selector real y el catálogo de ejemplo desaparece. El catálogo
   queda solo donde no hay selector real (simulador, iOS sin el entitlement), con la
   etiqueta de ejemplo. Los resúmenes cuentan lo que se bloquea de verdad. En Android
   desaparece "Sitios"; en iOS los sitios salen del selector de Tiempo de uso. El
   onboarding hace lo mismo.
3. **Las tres propuestas:** (a) con un modo profundo, el play de una rutina manual lleva a
   Focus con el modo y la duración listos, y ahí se mantiene el botón; (b) una sesión que el
   usuario termina por decisión (salida o emergencia) marca como empezadas las ventanas
   abiertas en ese momento; (c) una ventana sin hora de fin arranca como sesión abierta, y
   profundo corre como firme, igual que "Sin límite".
4. **Un solo promedio:** los dos sobre los días transcurridos, con ceros.
5. **Terminar un vínculo:** el servidor gana una llamada que corta el vínculo, usada por
   Rechazar, Quitar, Salir del círculo y Salir del reto. Enmienda ADR-0033/0044. Desplegarla
   sigue siendo decisión del dueño; mientras el servidor desplegado no la tenga, la app
   dice lo que pasa de verdad.
6. **Mis reglas:** se quita el modo estricto, que nunca se implementó. Instalaciones y
   compras se quedan con su nota.
7. **Hábitos:** una sección "Hábitos esta semana" en la vista Semanal; "De por vida"
   guarda el resumen.
8. **Salvavidas:** se queda, con la línea que dice la salida gratis en suave y firme.
9. **Sesión vencida con la app cerrada:** `session/complete` se muestra una vez, la próxima
   vez que se abre la app.
10. **Intención:** un campo opcional en la hoja de duración de Focus.
11. **Barra de pestañas:** el indicador se funde en vez de deslizarse (regla 6 intacta).
12. **Arte de una sesión sin límite:** se dibuja al ritmo de 2 h y se completa ahí.
13. **Contacto:** gusmoreno.dev@gmail.com, en Ayuda y en `web/privacy.html` y
    `web/terms.html`. Desplegar `web/` queda para después.

