# Roadmap — Vesper

## Fase 0 — papeleo (día 1, en paralelo con todo)

- [ ] Solicitar el **Family Controls (Distribution) entitlement** en el portal de Apple
- [ ] Reservar los 4 bundle identifiers: app, monitor extension, shield action, report extension
- [ ] Crear cuenta de Google Play Console (14 días de espera para publicar)

Esto no bloquea nada del desarrollo de fase 1, pero el reloj de Apple corre en semanas.
Si no se manda el día 1, la fase 2 se retrasa por papeleo, no por código.

## Fase 1 — prototipo sin permisos (semanas 1-2)

Objetivo: una app usable que no pide ni un solo permiso. Ni uno, tampoco el de
notificaciones: el timer solo avisa con la app abierta. La notificación de fin de sesión
entra en fase 1.75, donde hay una razón real para pedir el permiso.

- Sistema de diseño e-ink completo
- Tres pantallas con swipe
- Configuración de sesión inline
- Hábitos declarados (máximo 5)
- Libro mayor del día con renglón `sin registrar`
- Pantalla de vida (opt-in)
- SQLite con migraciones

**Criterio de salida:** el autor la usa 7 días seguidos sin obligarse.
Si no pasa, el problema no era el bloqueo y hay que replantear antes de seguir.

## Fase 1.5 — salud (semana 3)

- HealthKit: workouts, pasos, sueño
- Health Connect en Android
- Hábitos verificados que se marcan solos
- Permiso pedido en contexto, no en onboarding

**Criterio de salida:** un hábito de gym se marca sin que el usuario toque nada.

## Fase 1.75 — velocidad (semana 4)

- Notificación local al terminar el timer (primer permiso que pide la app)
- Widget de pantalla de inicio que arranca sesión
- Live Activity / Dynamic Island con el timer
- Notificación de cierre semanal el domingo

**Criterio de salida:** un día completo de uso sin abrir la app.

## Fase 2 — bloqueo (semanas 5-8, condicionada al entitlement)

- iOS: FamilyControls, ManagedSettings, shield con diseño propio
- iOS: onboarding de nombrado de apps (ver ADR-0004)
- Android: foreground service + overlay, sin AccessibilityService
- Perfiles de bloqueo
- Los tres niveles de profundidad

**Criterio de salida:** el nivel `profundo` sobrevive un reinicio del teléfono
y nunca bloquea llamadas ni mapas.

## Fase 3 — estimación de uso

- iOS: eventos de umbral con reparto de presupuesto de schedules
- Android: `UsageStatsManager`
- Pestaña "realidad" con `DeviceActivityReport` embebido (iOS)
- Proyección de vida en redes, alimentada por datos reales

**Criterio de salida:** el número estimado nunca es mayor que el de Ajustes.

## Fuera de roadmap hasta nuevo aviso

Cuenta de usuario, sync, backend, social, leaderboards, modo oscuro, iPad,
i18n, monetización.
