# ADR-0019 — Las rutinas encienden sesiones, y Android bloquea sin AccessibilityService

**Estado:** aceptada · 2026-09-16

## Contexto

Hasta ayer una rutina era un recordatorio con buena cara: programaba una notificación y
nada más. No arrancaba sesiones, no aplicaba el modo, no sabía qué hacer si llegaba su
hora con una sesión en marcha, y no existían rutinas sin hora ("caminar 20 minutos").
Además todo el bloqueo real estaba pensado solo para iPhone.

Preguntas que había que contestar de una vez:

1. ¿Qué hace una rutina cuando llega su hora?
2. ¿Y si ya hay una sesión corriendo?
3. ¿Cómo se representa una rutina que no tiene hora?
4. ¿Cómo bloquea Android, si AccessibilityService está prohibido (`PLATFORM_ANDROID.md`)?

## Decisión

### Rutinas

- **Motor puro** en `src/domain/routines.ts`. Desde el reloj decide la ventana activa
  (incluida la que cruza la medianoche), el próximo inicio, el estado para la lista y
  una decisión por tic: `start`, `wait` o `none`.
- **Una rutina cuya ventana incluye ahora arranca una sesión** con su modo, que dura
  hasta el fin de la ventana. Una ventana abierta ("hasta que lo termines") se limita a
  8 horas.
- **Si hay una sesión corriendo, la rutina espera.** Nunca interrumpe. Cuando esa
  sesión termina, si la ventana sigue abierta, arranca.
- **Una ventana nunca se arranca dos veces.** Terminar su sesión antes fue una
  decisión; el motor recuerda la última ventana iniciada en ajustes.
- **Si dos ventanas se cruzan, manda la que empezó más tarde**: la intención más
  reciente es la vigente. La lista lo avisa.
- **Rutinas sin hora**: `startMinutes` nulo y una duración. Aparecen en Rutinas con un
  botón para arrancarlas en un toque. No mandan recordatorio.
- El motor corre dentro de la app cada 30 segundos, al volver al frente y cuando una
  sesión termina (`src/platform/hooks/useRoutineSync.ts`). Fuera de la app la llevan
  las notificaciones y, donde exista bloqueo nativo, el sistema.

### Android

- **Un módulo Expo local en Kotlin**, `modules/vesper-blocking/`, sin dependencias de
  terceros: ninguna librería del ecosistema hace esto sin AccessibilityService.
- **Detección**: `UsageStatsManager.queryEvents` desde un servicio en primer plano de
  tipo `specialUse`, sondeando cada segundo mientras la pantalla está encendida.
- **Escudo**: una vista `TYPE_APPLICATION_OVERLAY` con un solo botón "Volver"; una
  actividad translúcida de respaldo para apps que ocultan superposiciones.
- **Selector de apps** con `<queries>` de intent de lanzador, nunca `QUERY_ALL_PACKAGES`.
- **Dos permisos por Ajustes del sistema**: acceso de uso y mostrar sobre otras apps.
  Sin ellos no hay bloqueo y la pantalla lo dice.
- **Fases**: 1) selector y bloqueo mientras corre una sesión; 2) ventanas de rutina con
  alarmas exactas y reinicio; 3) declaraciones de Play (servicio `specialUse`, seguridad
  de datos).
- La superficie JS es la misma que en iOS: `src/platform/blocking.ios.ts` y
  `blocking.android.ts` exportan lo mismo, y los stores no cambian.

## Consecuencias

- La pestaña Rutinas muestra estado real: "Activa · hasta las 18:00", "Hoy a las 21:30",
  "Cuando quieras · 20 min", y ordena por lo que corre y lo que viene.
- Focus muestra la próxima rutina bajo el modo, y el modo se cambia desde una hoja.
- Migración 003: `duration_ms` en `schedules`; `start_minutes = -1` significa sin hora.
- Límites honestos de Android: el sistema abre la app bloqueada y el escudo la cubre en
  un segundo, no la impide; notificación permanente durante la sesión; los fabricantes
  que matan servicios (Xiaomi, Samsung, OnePlus) pueden apagar el bloqueo en silencio,
  y la app lo detecta y lo dice.
- Google Play revisa a mano el servicio `specialUse`: hace falta texto y video antes de
  publicar. Acceso de uso y superposición no llevan formulario.
- Coste estimado del bloqueo Android completo: unos 13 días de trabajo humano; la fase 1
  se hace ahora, la 2 cuando el motor de rutinas esté probado en teléfono.
