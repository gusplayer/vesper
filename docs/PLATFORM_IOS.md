# Plataforma iOS — Screen Time

Referencia técnica. Relevante a partir de la fase 2. Léelo antes de tocar cualquier cosa
de bloqueo o de uso.

## Entitlement

`com.apple.developer.family-controls` en modalidad de distribución requiere
**aprobación manual de Apple**. Tarda días o semanas.

Sin él no se puede ni construir un dev client de Expo — se queda uno atrapado en builds
locales de Xcode. Hay que pedirlo para **cada bundle identifier**, y con las tres
extensiones son cuatro solicitudes.

Requisito del usuario final: el iPhone debe tener FaceID o código configurado.
Sin eso, la autorización de Screen Time no se puede conceder. Hay que detectarlo antes
de mostrar la pantalla de permisos.

## Los cuatro componentes

| Componente | Sandbox | Puede escribir a App Group |
|---|---|---|
| App principal | normal | sí |
| `DeviceActivityMonitor` extension | normal | **sí** |
| `ShieldAction` extension | normal | **sí** |
| `DeviceActivityReport` extension | solo lectura | **no** |

## Lo que se puede persistir

**Eventos de `DeviceActivityMonitor`:** `eventDidReachThreshold`,
`eventWillReachThresholdWarning`, `intervalDidStart`, `intervalDidEnd`.

**Eventos de `ShieldAction`:** cada vez que el usuario choca con un bloqueo y pulsa un
botón. Es la señal más valiosa de toda la integración: intentos de apertura, hora del
día, rendiciones. Va a `usage_events` con `kind = 'shield_hit'` y derivados.

## Lo que NO se puede persistir

Nada de `DeviceActivityReport`. La extensión corre en un sandbox de solo lectura por
diseño de Apple. Fallan silenciosamente: escrituras a `UserDefaults` de App Group,
escrituras a archivos del contenedor compartido, HTTP, notificaciones locales,
`UIPasteboard`, iCloud KVS.

Dato útil: `Application.bundleIdentifier` solo devuelve un valor no nulo **dentro de la
Report Extension**. En la app principal y en el Monitor siempre es nil.

**Consecuencia de arquitectura:** la app tiene dos superficies que nunca se reconcilian.
Ver ADR-0004.

## Estimación de uso por eventos

El API no fue diseñado para time tracking. La técnica es registrar umbrales acumulativos
y contar cuántos se disparan.

- Bloques de 2h con eventos cada 5 min: 5, 10, 15 … 115 → 23 eventos por schedule
- 12 schedules cubren el día
- Cada evento tiene su propio set de tokens, así que **se puede estimar por app**
  registrando N eventos por app dentro del mismo schedule

### Presupuesto de schedules

iOS acepta ~20-21 `DeviceActivityName` simultáneos antes de lanzar error.
Reparto propuesto:

| Uso | Schedules |
|---|---|
| Tracking de uso | 12 |
| Sesión de foco activa | 1 |
| Schedules recurrentes del usuario | 3 |
| Reserva | 4 |

**No gastar los 20.** Cuando se acaban, `startMonitoring` falla y el tracking se detiene
en silencio — el peor modo de falla posible.

### Precisión

El conteo por umbrales **siempre subcuenta**, hasta 5 min por bloque activo.
Con 4-6 bloques activos al día son 10-15 min diarios de subconteo sistemático.

**Decisión:** no aplicar factor de corrección. Presentar siempre como piso:
*"al menos 2h 15m"*. Un número que nunca exagera compra credibilidad cuando el usuario
lo compara con Ajustes.

Otros límites conocidos:
- Los eventos llegan con latencia de minutos
- Los últimos 5 min de cada intervalo son poco confiables: `intervalDidEnd` se dispara
  sin importar si hubo uso
- Registrar muchos eventos es lento; mover a background task
- No hay límite documentado de eventos por actividad, pero hay reportes de eventos que
  dejan de dispararse con conteos altos. **Medir empíricamente en device físico durante
  48h antes de dar el desglose por app por bueno**

## Bloqueo

```swift
let store = ManagedSettingsStore(named: .init("focus"))
store.shield.applications = selection.applicationTokens
store.shield.applications = nil   // liberar
```

Personalizable con `ShieldConfiguration` (diseño) y `ShieldAction` (botones).
El shield sobrevive reinicios del teléfono. Documentarlo para el usuario.

**Lista de nunca bloqueables:** teléfono, mensajes, mapas, cámara, ajustes de emergencia.
Esto no es negociable — un usuario encerrado sin poder llamar es un problema de
responsabilidad, no una reseña mala.

## Prohibiciones

- No resolver tokens a nombres de apps por OCR ni ningún otro medio. Apple ofusca a
  propósito y circunvalarlo es motivo de rechazo.
- No usar VPN ni perfiles MDM para bloquear. Es el camino viejo y está cerrado.
