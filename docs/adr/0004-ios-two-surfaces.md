# ADR-0004 — iOS tiene dos superficies de datos que no se reconcilian

**Estado:** aceptada · 2026-08

## Contexto

En iOS, `DeviceActivityReport` puede mostrar el uso real por app, por hora, con histórico
completo, idéntico a Ajustes. Pero corre en un sandbox de solo lectura del que no sale
ningún dato: fallan App Group, archivos, HTTP, notificaciones locales, pasteboard y
iCloud. Apple confirmó que es intencional.

Separadamente, `DeviceActivityMonitor` y `ShieldAction` sí pueden persistir, pero solo
entregan eventos: umbrales cruzados y toques en el bloqueo. De ahí sale un estimado,
no el dato real.

La tentación es intentar reconciliar ambos o buscar un canal de salida. Ambas cosas
consumen semanas y la segunda es motivo de rechazo.

## Decisión

La app tiene **dos superficies conceptualmente separadas** y nunca intenta unirlas:

1. **"Realidad"** — vista `DeviceActivityReport` embebida. Números exactos, desglose por
   app, histórico completo. Efímero: se muestra y se va. No se guarda nada.
2. **"Progreso"** — estimados por eventos, intentos bloqueados, sesiones, metas.
   Persistente, sincronizable, es donde vive todo lo demás.

Los números de una nunca se muestran junto a los de la otra ni se comparan en UI.

Para el desglose por app en la superficie persistente, el usuario **nombra sus apps una
vez** en el onboarding: se le presenta el `FamilyActivityPicker` para elegir una sola
app, y luego se le pide el nombre. Se guarda en `blocked_apps.user_label`. El nombre
viene del usuario, no de desofuscar nada.

## Consecuencias

- Features que quedan imposibles con dato real en iOS: reporte semanal por push o email,
  widget con el uso, leaderboards, exportar CSV, panel web, comparar semanas fuera del
  Report. Todos usan el estimado.
- El estimado siempre se presenta como piso: *"al menos 2h 15m"*. Nunca como cifra exacta.
- `usage_events` nunca recibe datos del Report. Está escrito en `DATA_MODEL.md` y en
  `CLAUDE.md`.
- Android no tiene esta división: ahí el dato real es persistible. La UI debe tolerar
  que la superficie "Realidad" no exista en Android y que el estimado sea exacto.
