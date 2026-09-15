# ADR-0016 — El prototipo completo toma la forma de Brick

**Estado:** aceptada · 2026-09-15

## Contexto

Con la fase 1 cerrada en código, el dueño del producto pidió tres cosas a la vez: que la
UI/UX se parezca de cerca a Brick (Mobbin, iOS), que sea fácil de entender, y que exista
un prototipo navegable de **todas** las fases —salud, notificaciones, bloqueo, estimación
de uso— con datos falsos, sin tocar backend ni base de datos.

Eso choca de frente con cinco reglas duras y tres ADR:

- Regla 1 y ADR-0007: sin pantalla de ajustes. Brick tiene una, y es donde viven las
  reglas de bloqueo y el desbloqueo de emergencia.
- Regla 2 y ADR-0009: tres pantallas, swipe, sin tab bar. Brick tiene cuatro pestañas.
- Regla 3: un control primario por pantalla. Brick tiene tarjetas, toggles y listas.
- Reglas 5 y 6 y ADR-0006: cuatro tonos e-ink, serif, sin sombras ni radios. Brick es
  sans geométrica, tarjetas blancas con radio grande, sombra suave, un azul de acento y
  tema oscuro durante la sesión.
- "Sin gráficos" (ADR-0006): Brick tiene barras semanales, mensuales y una grilla de
  días.

Las opciones:

1. **Seguir con e-ink** y traer solo patrones de Brick. Es lo que hicieron ADR-0014 y
   0015. No responde a lo pedido.
2. **Dos apps**: mantener la e-ink y construir el prototipo aparte. Duplica todo y nadie
   va a mantener la vieja.
3. **Pivotar**: el prototipo adopta la estructura y el lenguaje visual de Brick, y las
   reglas que lo impiden quedan superadas por este ADR. Lo que Vesper tiene y Brick no
   —profundidades, hábitos, meta semanal, libro mayor, semanas de vida— se acomoda dentro
   de esa estructura en vez de perderse.

## Decisión

Opción 3. Quedan **superadas** las reglas 1, 2, 3, 5 y 6 de `CLAUDE.md` y los ADR 0006,
0007 y 0009 en lo que contradigan esto. Siguen vigentes las reglas 4, 7, 8, 9 y 10, y los
ADR 0003, 0004, 0005, 0010, 0012 y 0013 en su fondo.

La forma:

- **Cuatro pestañas** en una barra de solo texto con punto indicador: Foco, Horarios,
  Actividad, Ajustes. La sesión activa y el cierre son rutas a pantalla completa.
- **Foco** es la portada de Brick: contador del día arriba, un objeto al centro, el modo
  activo debajo con cuántas apps bloquea, y un único botón. Durante la sesión el tema se
  invierte a oscuro.
- **Modos** reemplazan la "configuración de sesión": nombre, comportamiento (bloquear
  seleccionadas / permitir solo seleccionadas), apps, sitios, y la profundidad de Vesper.
- **Horarios** programan un modo por días y horas, con conflicto detectado.
- **Actividad** tiene vista semanal, mensual y de por vida; ahí viven la meta semanal,
  los hábitos, el libro mayor del día y la cuadrícula de semanas de vida.
- **Ajustes** agrupa Mis reglas, Desbloqueo de emergencia, Live Activities,
  Notificaciones, Salud, Ayuda y Acerca de. No hay cuenta: sigue siendo local-first.
- **Onboarding** de Brick: bienvenida, para qué es tu primer modo, Screen Time, Salud,
  elegir apps, hacerlo rutina, notificaciones, y un tour de tres pasos.

La técnica:

- **Un solo sistema de diseño**, centralizado en `src/design/`: tokens por tema (claro y
  oscuro), tipografía Outfit, radios, sombras y espaciado. Ningún componente ni pantalla
  escribe un color o un tamaño literal.
- **Una capa de datos falsa con la forma de la real.** `src/data/` expone hooks; detrás hay
  stores en memoria sembrados desde `src/data/seed.ts`. Cuando llegue la implementación
  real, se reemplaza esa capa y la UI no se entera. Los repositorios de SQLite y el dominio
  puro quedan en el repo, con sus tests, para ese momento.
- La lógica pura ya existente (`domain/`) se reutiliza donde aplica: reloj de sesión,
  semana, hábitos, semanas de vida, libro mayor.

## Consecuencias

- La identidad e-ink se abandona. El riesgo aceptado en ADR-0006 ("se lee como app sin
  diseño") deja de correrse; a cambio la app se parece a Brick, y hay que ganar
  identidad por contenido, no por estética.
- Aparecen dependencias: la fuente Outfit y `@expo/vector-icons` (Feather). Ambas son
  activos estáticos, no lógica.
- Todo dato que muestra el prototipo es falso hasta nuevo aviso: modos, apps, horarios,
  estadísticas, uso, salud. Ninguna pantalla debe presentarse como verificada.
- `DESIGN_SYSTEM.md` se reescribe. `PRD.md` describe la estructura nueva. Los ADR
  superados reciben una nota y no se editan.
- El bloqueo real (ADR-0003) y la estimación de uso (ADR-0004) siguen sin construirse:
  lo que hay es su UI. Las reglas de plataforma no cambian.
