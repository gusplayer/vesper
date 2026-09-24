# ADR-0046 — Lo que la app tiene que decir por escrito, y dónde

**Estado:** aceptada · 2026-09-24

## Contexto

Dos cosas que la app debe decir y hoy no dice, y que conviene decidir juntas porque
comparten la pregunta: ¿dónde vive un texto que el usuario y una tienda tienen que poder
leer?

1. **No hay Términos ni Privacidad.** Acerca de los promete en el pie y no llevan a
   ninguna parte. Cuando eso se anotó, la app era local entera. Desde ADR-0033 hay datos
   de personas en un servidor —alias, nombre y agregados por semana— y el propio ADR dejó
   dicho que hace falta una política de privacidad antes de publicar. Las tiendas la
   piden como URL, no como pantalla.

2. **Falta la divulgación destacada del acceso de uso.** Play exige, para
   `PACKAGE_USAGE_STATS`, una pantalla propia **antes** del diálogo del sistema, que diga
   qué se lee y para qué. `PLAY_DECLARATIONS.md` la tiene escrita desde hace tiempo y la
   pantalla nunca se construyó. ADR-0029 además le añadió un segundo propósito —el
   desglose por app, que se lee con la app abierta y sin sesión— y una divulgación que
   solo mencione el primero ya no describe el build.

## Decisión

1. **Términos y Privacidad viven en `web/`**, el sitio que ya existe en Vercel, en
   `/terminos` y `/privacidad` con sus pares en inglés, siguiendo el idioma del
   navegador como el resto de la página. La app **enlaza**, no los duplica: una tienda
   necesita una URL, una política cambia sin publicar una versión nueva, y mantener el
   mismo texto en dos sitios garantiza que un día digan cosas distintas.
   El pie de Acerca de deja de ser decorativo y abre el navegador.

2. **La divulgación destacada es una ruta a pantalla completa** y aparece **inmediatamente
   antes del diálogo del sistema, en cada sitio que lo pide**: hoy el paso de Tiempo de uso
   del onboarding (`onboarding/screen-time`) y el selector de apps reales. No se adelanta a
   un momento en el que el permiso todavía no se va a pedir, y el onboarding la puede
   saltar entera, porque nunca exige un permiso (ADR-0026).
   Dice los **dos** propósitos por separado —qué app está al frente durante una sesión, y
   cuánto estuvo cada app elegida hoy y esta semana—, que nada de eso sale del teléfono y
   que la app no guarda historial propio, y ofrece continuar o volver. Solo después
   aparece el diálogo del sistema.

3. **Los textos dicen lo que el código hace, y nada más.** La privacidad describe lo que
   de verdad sale del teléfono: nada, salvo lo que el círculo sube cuando el usuario lo
   enciende, métrica por métrica (ADR-0035). Si un día el código cambia, cambia el texto
   en la misma tanda.

## Consecuencias

- La app gana un enlace externo y una ruta nueva; `web/` gana cuatro páginas y sigue sin
  framework, sin analítica y sin cookies (ADR-0034).
- Play puede recibir la ficha sin ese hueco, y la divulgación describe el build de verdad.
- **Estos textos no son un dictamen legal.** Los escribe quien conoce el código, dicen
  exactamente lo que el código hace, y quedan marcados para que alguien con criterio
  legal los revise antes de publicar. No se publican como definitivos sin esa revisión.
- Alternativa descartada: pantallas dentro de la app. Obliga a publicar una versión para
  corregir una coma y no le da a la tienda la URL que pide.
