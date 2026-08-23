# Plataforma Android

Referencia técnica. Relevante a partir de la fase 2.

## Datos de uso

`UsageStatsManager.queryEvents()` con permiso `PACKAGE_USAGE_STATS`.
Da eventos `ACTIVITY_RESUMED` / `ACTIVITY_PAUSED` por paquete con timestamps reales.

Todo lo que iOS niega: desglose por app, nombres reales, histórico de ~7-14 días
anterior a la instalación, precisión de milisegundos.

El permiso no se pide con un diálogo — hay que mandar al usuario a
`Settings.ACTION_USAGE_ACCESS_SETTINGS`. Fricción alta. Pedirlo tarde en el onboarding.

## Bloqueo

**Camino elegido: foreground service + overlay.**

- Foreground service con polling de `queryEvents` cada 500-1000ms
- Al detectar un paquete bloqueado, lanzar Activity propia o
  `TYPE_APPLICATION_OVERLAY` (`SYSTEM_ALERT_WINDOW`)
- Declarar `foregroundServiceType` válido en Android 14+ y justificarlo en Play Console

**Camino prohibido: `AccessibilityService`.**

Android 17 revoca automáticamente el permiso a apps que no son herramientas de
accesibilidad cuando Advanced Protection está activo, y el usuario no puede volver a
concederlo sin apagar ese modo. Declararse `isAccessibilityTool="true"` sin serlo es
rechazo directo en Play.

Es una capacidad que Google está desmantelando. No construir sobre ella.

## Notificaciones

`NotificationListenerService` permite detectar y descartar notificaciones durante una
sesión. Es lo único que iOS no puede hacer de ninguna forma.

Permiso sensible con declaración en Play, pero defendible para una app de foco.

## Los tres dolores

1. **Battery management de OEM.** Xiaomi, Oppo, Vivo y Samsung matan foreground
   services. Necesita onboarding específico por fabricante (referencia: dontkillmyapp.com)
   y detección de service muerto con recuperación.
2. **Foreground service types.** Android 14+ exige tipo declarado y justificado.
   `specialUse` requiere texto de justificación en la consola.
3. **Fricción de permisos.** Usage access y overlay se conceden en Ajustes, no con
   diálogos. Cada uno pierde usuarios.

## Salud

**Health Connect**, no Google Fit. Los APIs de Google Fit se soportan solo hasta finales
de 2026 y Google recomienda migrar a Health Connect para apps móviles.

Tipos relevantes: `StepsRecord`, `ExerciseSessionRecord`, `SleepSessionRecord`,
`TotalCaloriesBurnedRecord`.

**Advertencia de producto:** los datos existentes de Google Fit no se transfieren
automáticamente a Health Connect — los usuarios conectan cada fuente ellos mismos.
Un usuario nuevo puede tener Health Connect completamente vacío aunque lleve años
con Fit. El onboarding tiene que detectarlo y guiarlo.

Play exige formulario de declaración específico para Health Connect. Sumar una semana
extra de review.
