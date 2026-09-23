# ADR-0040 — Dos avisos son dos momentos, no un zumbido

**Estado:** aceptada · 2026-09-23 · enmienda a ADR-0027

## Contexto

ADR-0027 fijó el presupuesto: fuera de sesión, máximo dos avisos al día además de los de
sesión y rutina, nada entre 22:00 y 8:00, y una prioridad entre las cinco clases
(`streakRisk > challengeRisk > challengeEnd > noFocus > reactivation`).

El presupuesto se respeta. Lo que nadie decidió es **a qué hora** cae cada uno, y la
implementación los agenda todos en `prefs.reminderMinutes`, la hora que el usuario eligió
para su aviso diario. Así que quien tenga una racha en riesgo y un reto que termina
recibe los dos a las 20:00:00, al mismo segundo.

El teléfono los junta en una sola notificación agrupada o en un solo zumbido. El
presupuesto dice "dos avisos" y el usuario percibe uno: el segundo mensaje no se lee, y
el trabajo de decidir cuál importaba más se pierde en la bandeja.

## Decisión

**Cada clase de aviso tiene un desfase fijo dentro de su hora**, derivado de su posición
en el orden de prioridad: `streakRisk` en el minuto elegido, y las siguientes a tres
minutos una de otra. Con la hora por defecto (20:00) eso da 20:00, 20:03, 20:06, 20:09 y
20:12.

El desfase es fijo y no aleatorio: la misma clase llega siempre a la misma hora, así que
la bandeja es predecible y el usuario aprende qué es cada cosa sin leerla.

## Consecuencias

- Dos avisos permitidos llegan como dos momentos, que es lo que el presupuesto quería
  decir.
- El tope superior del selector de hora es 21:00 y el desfase mayor es de doce minutos,
  así que ningún aviso se acerca a las 22:00: las horas de silencio siguen intactas sin
  ningún caso especial.
- El silencio absoluto durante una sesión y una pausa no cambia: esto solo mueve minutos
  dentro de una hora en la que ya se iba a notificar.
- Alternativa descartada: fusionar los dos avisos en un solo texto ("Tu racha está en
  riesgo y Caminar termina hoy"). Junta dos cosas que piden acciones distintas y obliga a
  escribir una frase por cada par posible.
