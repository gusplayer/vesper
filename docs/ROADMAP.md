# Roadmap — Vesper

Escrito para la fase 1 e-ink. Desde ADR-0016 y ADR-0017 el orden de las fases dejó de
cumplirse: el prototipo Brick trajo de golpe la UI de todas ellas y la capa de plataforma
trajo las capacidades reales. Lo que queda por hacer está en `STATUS.md` › "Qué falta".
Aquí se marca, por fase, qué se hizo y qué sigue abierto.

## Fase 0 — papeleo

- [ ] Solicitar el **Family Controls (Distribution) entitlement** en el portal de Apple
      para los cuatro bundle ids (app, `ActivityMonitorExtension`, `ShieldAction`,
      `ShieldConfiguration`). **Sigue sin pedirse; es lo único que bloquea el bloqueo en iOS.**
- [x] Reservar los bundle identifiers: están en `app.json` (`com.gusplayer.vesper` y
      sus extensiones, más `ExpoWidgetsTarget`). No hay extensión de `DeviceActivityReport` (ADR-0004)
- [ ] Crear cuenta de Google Play Console (14 días de espera para publicar). Las
      declaraciones ya están escritas en `PLAY_DECLARATIONS.md` y la ficha en `STORE_LISTING.md`

## Fase 1 — prototipo sin permisos — hecha y superada

Objetivo: una app usable que no pide ni un solo permiso.

- [x] Sistema de diseño e-ink (ADR-0006) → reemplazado por Brick (ADR-0016)
- [x] Tres pantallas con swipe (ADR-0009) → reemplazadas por cuatro pestañas (ADR-0016)
- [x] Configuración de sesión inline → reemplazada por modos y la fila de duración (ADR-0022)
- [x] Hábitos declarados (máximo 5)
- [x] Libro mayor del día con renglón `sin registrar` (hoy en Actividad › De por vida)
- [x] Pantalla de vida (hoy tarjeta en Actividad y Ajustes › Vida)
- [x] SQLite con migraciones

**Criterio de salida:** el autor la usa 7 días seguidos sin obligarse. **Sin cumplir**:
nada se ha usado en un teléfono.

## Fase 1.5 — salud

- [x] HealthKit: workouts, pasos, sueño (`react-native-health`, ADR-0017)
- [ ] Health Connect en Android (no integrado; `platform/health.status()` lo dice)
- [x] Hábitos verificados que se marcan solos (`domain/healthMarks`, `useHealthSync`)
- [x] Permiso pedido en contexto (Ajustes › Salud y el paso de onboarding, con "Ahora no")

**Criterio de salida:** un hábito de gym se marca sin que el usuario toque nada. **Sin
verificar**: el simulador no tiene datos de Salud.

## Fase 1.75 — velocidad

- [x] Notificación local al terminar el timer (y al terminar la pausa)
- [ ] Widget de pantalla de inicio que arranca sesión
- [x] Live Activity / Dynamic Island con relojes nativos (ADR-0023)
- [x] Notificación de cierre semanal el domingo. No habrá pantalla de cierre (ADR-0026)

**Criterio de salida:** un día completo de uso sin abrir la app. **Sin verificar** en teléfono.

## Fase 2 — bloqueo (condicionada al entitlement en iOS)

- [x] iOS: FamilyControls, ManagedSettings, shield con diseño propio (`shieldPalette`).
      Solo compila hasta que llegue el entitlement
- [ ] iOS: onboarding de nombrado de apps (ADR-0004). No existe; el token opaco nunca se
      resuelve y las apps del catálogo son de demostración
- [x] Android: foreground service + overlay, sin AccessibilityService (ADR-0019, verificado en emulador)
- [x] Perfiles de bloqueo → son los modos (bloquear / permitir, apps, sitios)
- [x] Los tres niveles de profundidad, con el ritual de salida (ADR-0025)
- [x] Ventanas de rutina en el sistema con la app cerrada (iOS `DeviceActivity`, Android `AlarmManager`)
- [x] Pausas que levantan el bloqueo (ADR-0022, ADR-0023)

**Criterio de salida:** el nivel `profundo` sobrevive un reinicio del teléfono y nunca
bloquea llamadas ni mapas. **Sin verificar** en teléfono; en Android el escudo nunca
cubre el marcador, el launcher, Ajustes ni SystemUI.

## Fase 3 — estimación de uso — empezada en Android (ADR-0029)

- [ ] iOS: eventos de umbral con reparto de presupuesto de schedules (`PLATFORM_IOS.md`)
- [x] Android: `UsageStatsManager` por app, leído a demanda para hoy y la semana (`UsageQuery.kt`, ADR-0029). Sin historial persistido
- [ ] Pestaña "realidad" con `DeviceActivityReport` embebido (iOS)
- [x] Proyección de vida en redes, alimentada por datos reales en Android (ADR-0029); iOS sigue en el estimado

En iOS "tiempo consumido" y "redes" siguen siendo el estimado de demostración (`data/seed USAGE`), y la pantalla lo dice.

**Criterio de salida:** el número estimado nunca es mayor que el de Ajustes.

## Fase 4 — círculo con backend — sin empezar

ADR-0021 dejó la capa de datos y las pantallas; falta el ADR que elija servidor e
identidad. Hasta entonces `platform/circle.status()` dice que nada viaja.

## Fuera de roadmap hasta nuevo aviso

Cuenta de usuario fuera del círculo, sync general, leaderboards, modo oscuro como ajuste,
iPad, monetización. Lo que salió de esta lista porque ya existe: i18n (ADR-0020), social
en la forma del círculo (ADR-0021).
