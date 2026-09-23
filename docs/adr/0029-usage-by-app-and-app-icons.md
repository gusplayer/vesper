# ADR-0029 — Uso por app en Actividad y el icono de cada app

**Estado:** aceptada · 2026-09-18

## Contexto

El PRD promete tres monedas y la tercera, "tiempo consumido", es el uso de redes
presentado siempre como piso (ADR-0004, ADR-0005). Hoy eso existe solo como total:

- `data/types.ts` define `UsageEstimate` con `todayMs`, `weekMs` y `byApp`, pero el único
  valor es la constante de demostración `USAGE` en `data/seed.ts` (Instagram 34 min,
  TikTok 22, YouTube 11, X 5). No vive en SQLite y "Borrar todo y reiniciar" no lo toca.
- La UI usa solo los totales: Actividad › Hoy muestra "redes · al menos 1 h 12 min";
  la tarjeta Vida proyecta `weekMs` con la nota "Estimación con datos de ejemplo"; el
  círculo comparte `weekMs` si el usuario lo elige. `byApp` no se lee en ninguna pantalla.
- Ninguna capa de plataforma lee uso. En Android, `ForegroundWatcher` consulta
  `UsageStatsManager.queryEvents` solo para saber qué app está al frente y descarta el
  dato. Las tablas `usage_events` y `blocked_apps` de `DATA_MODEL.md` no existen; el
  `ROADMAP.md` las deja en fase 3, sin empezar.
- Los iconos de app son `AppIcon`: un cuadro del color de la marca con una inicial. El
  único icono real es `AppImage`, que dibuja el PNG que Android entrega por
  `listLaunchableApps(true)`, y solo se usa en el selector de apps de Android.

Lo que cada plataforma permite:

| | Uso real por app | Icono real |
|---|---|---|
| Android | `UsageStatsManager.queryUsageStats` por paquete, con el permiso de acceso de uso que el bloqueo ya pide | Sí, `PackageManager` (ya existe) |
| iOS | Solo dentro de `DeviceActivityReport`, un sandbox del que no sale nada (ADR-0004). Fuera de ahí, un estimado por umbrales de `DeviceActivityMonitor` sobre tokens opacos, que el usuario tendría que nombrar (ADR-0004, sin construir) | Nunca. El token es opaco y resolverlo a un nombre o logo es motivo de rechazo (`CLAUDE.md`). La única vía legal es la vista nativa `Label(token)` de SwiftUI, que `react-native-device-activity` 0.6.1 no expone |

Dibujar a mano los logos de Instagram, TikTok, YouTube o X es posible con
`react-native-svg`, pero solo serviría al catálogo de demostración (en iOS nunca se
sabe qué app es; en Android ya hay icono real) y usa marcas registradas de terceros en
una pantalla de la app.

## Decisión

1. **Uso por app como modelo de lectura efímero, detrás de `src/platform/usage.ts`.**
   El módulo expone `status()` y `loadUsageByApp(from, to)`. En Android lo sirve el
   módulo Kotlin con `queryUsageStats` agregado por paquete para la ventana pedida; no
   se persiste nada: se lee al abrir Actividad, como hace el Report en iOS. En iOS
   `status().reason` dice que el uso por app no existe fuera del Report y la pantalla
   sigue mostrando solo el piso total. Los umbrales de iOS y la tabla `usage_events`
   quedan en fase 3 como están.
2. **Un solo componente de icono, `AppTile`.** Recibe `{ icon: base64 | null, initial,
   color }`: dibuja el PNG real cuando la plataforma lo da (Android) y el cuadro con la
   inicial cuando no (iOS, demostración). `AppIcon` y `AppImage` se funden en él. No se
   dibujan logos de marcas a mano.
3. **Actividad › Hoy gana un desglose bajo la fila "redes".** Hasta cinco apps, cada
   una una `AppRow` con su `AppTile`, el nombre y "al menos X min" (piso, ADR-0004), en
   orden de uso. Sin barras comparativas ni porcentajes: es un libro mayor, no un
   ranking. Mientras la plataforma diga que no hay dato, el desglose sale de la
   demostración con una nota que lo dice y la razón de `status()` ("Desglose con datos
   de ejemplo. iOS solo muestra el uso por app dentro de Tiempo de uso."). Con dato
   real, la nota dice a qué hora se leyó.
4. **La moneda no cambia.** El desglose nunca se suma al foco ni a lo verificado
   (regla 9, ADR-0005). El total de la fila "redes" y las cifras por app vienen de la
   misma lectura, así el desglose nunca supera al total.

## Consecuencias

- Android muestra uso real por app con icono real, sin permiso nuevo. iOS sigue en el
  piso total hasta que exista el estimado por umbrales o la pestaña "Realidad" con
  `DeviceActivityReport` embebido (fase 3).
- `AppTile` entra al índice de `design/components` y `AppIcon` sale (siguen siendo 52);
  `AppImage`, que era interno, desaparece.
- `USAGE` de la semilla pasa a ser el fallback del piso, y se retira el día que
  `platform/usage` sirva las dos plataformas.
- Alternativas descartadas: logos de marca dibujados a mano (marcas de terceros, solo
  demostración); persistir `UsageStatsManager` en `usage_events` desde ya (fase 3, no
  hace falta para hoy y esta semana); resolver tokens de iOS por cualquier medio
  (prohibido).
