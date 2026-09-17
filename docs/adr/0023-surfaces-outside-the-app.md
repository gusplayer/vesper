# ADR-0023 — Las superficies fuera de la app: pantalla bloqueada, isla, escudo y aviso

**Estado:** aceptada · 2026-09-17

## Contexto

Una sesión de foco pasa casi toda su vida con Vesper cerrada: el teléfono bloqueado en
la mesa, el usuario en otra app, o una rutina que arranca a las 9:00 sin que nadie abra
nada. Lo que la sesión muestra en esos momentos no vive en `src/app/`: son cuatro
superficies del sistema, y hasta hoy cada una se construyó por separado, sin una
decisión común y con huecos que el usuario ve antes que nosotros.

Revisión del estado en `main` (2026-09-17):

| Superficie | iOS | Android |
|---|---|---|
| Pantalla bloqueada | Live Activity de `expo-widgets`: modo, "Enfocado · quedan 21m" y reloj nativo. **"quedan 21m" se congela** cuando iOS suspende el JS (el refresco vive en un `setInterval`) | Notificación permanente del servicio: título del escudo y "Sesión de foco". **Sin reloj** y con nombre de canal en español fijo |
| Barra superior en otras apps | Dynamic Island: cuadrado y "21m" en texto, **también congelado**; el expandido repite el banner | Icono en la barra de estado. Nada más |
| Pausa (ADR-0022) | La actividad cuenta la pausa, con las mismas tintas oscuras que el foco: **no se distingue** | `release()` apaga el servicio: **la notificación desaparece** y, si la app muere durante la pausa, el bloqueo no vuelve |
| Abrir una app bloqueada | Escudo del sistema con título, subtítulo y botón "Volver a Vesper" que **solo cierra la app**; colores por defecto de iOS, sin icono | Superposición oscura con título, subtítulo y "Volver" al inicio. Sin hora de fin |
| Rutina que arranca con la app cerrada | El sistema sube el escudo (`DeviceActivity`) y llega el aviso "Empieza Trabajo". **No hay Live Activity hasta abrir la app** | La alarma arranca el servicio: escudo y notificación, sin JS. Igual: sin reloj |

El vocabulario ya está decidido: el descanso es **pausa** en español y **break** en
inglés (ADR-0022). No usamos "descanso corto" ni ningún término de pomodoro.

## Decisión

1. **Nada que muestre el sistema depende de un temporizador de JS.** Todo texto con
   tiempo se cuenta con relojes nativos: `Text(timerInterval:)` en la Live Activity,
   cronómetro de la notificación en Android. El JS fija inicio y fin una sola vez.
2. **La pausa se ve distinta en todas partes**, con la misma regla que la app: el foco es
   oscuro (tinta) y la pausa es clara (papel). En la isla, el glifo cambia de cuadrado a
   pausa. El texto dice "Pausa" y cuenta lo que falta para volver.
3. **La Live Activity tiene las cinco regiones** de la isla: compacta con glifo y reloj
   nativo, mínima con el glifo, expandida con modo, estado y reloj. Tocarla abre la
   sesión. Sigue arrancando solo desde la app: ActivityKit no permite crearla desde la
   extensión de `DeviceActivity` ni sin servidor de push, y Vesper no tiene servidor
   (regla 7). Cuando una rutina arranca con la app cerrada, la pantalla bloqueada muestra
   el aviso del sistema y el escudo; la actividad aparece al abrir la app. Se documenta
   como límite, no se disimula.
4. **El escudo de iOS lleva la tinta de la sesión**: fondo oscuro, texto claro, icono
   `square.fill`, botón con el papel. El botón dice lo que hace. Si la librería puede
   abrir Vesper (`openApp` sobre el esquema `device-activity`), dice "Volver a Vesper";
   si no, dice "Cerrar". Nunca una promesa que el botón no cumple.
5. **En Android la pausa es del servicio, no de JS.** `pausePlan(untilMs)` baja el
   escudo, detiene el vigilante y deja la notificación contando la pausa; al vencer,
   el servicio vuelve solo a vigilar aunque la app haya muerto (mismo patrón que
   `endsAt`, fase 2). iOS implementa `pausePlan` como `release()` y `resumePlan` como
   `applyPlan`, así el hook compartido no sabe qué plataforma responde.
6. **La notificación de Android es la pantalla bloqueada de Android.** Cuenta hacia
   abajo (o hacia arriba en sesión sin límite), es pública, lleva al usuario a la
   sesión y su canal se nombra en el idioma de la app, que viaja con el plan. Donde
   Android 16 lo permita, se promueve como actualización en vivo (chip en la barra);
   donde no, es una notificación permanente y ya.
7. **El escudo de Android dice a qué hora se libera** cuando el plan tiene fin.

## Consecuencias

- Hay que recompilar el dev client de iOS: el widget se compila dentro de la extensión.
- `blockingTypes.ts` gana `pausePlan`/`resumePlan` y el plan lleva el nombre del canal.
- Lo que sigue sin poder verse en el simulador: el escudo de iOS (falta el entitlement)
  y la Live Activity arrancada por una rutina con la app cerrada (no existe por diseño).
- Sin dependencias nuevas.
