# ADR-0032 — Retos públicos: qué significa abrir un reto a gente que no está en tu círculo

**Estado:** propuesta · 2026-09-21 · reabre el ADR-0021

## Contexto

El dueño del producto pidió retos públicos, explícitamente, después de leer la
recomendación contraria del ADR-0031 ("sugeridos ahora, por invitación después"). La
decisión es suya y este ADR la toma en serio: no repite la objeción, la convierte en
diseño.

Lo que hoy impide un reto público no es una pantalla, son cuatro hechos:

1. **No hay servidor.** Regla 7 y ADR-0002. `platform/circle.status()` responde
   `available: false`. Ningún reto que involucre a alguien que no esté en este teléfono
   puede existir hasta que exista un backend. Ese backend es un ADR aparte y es el
   prerrequisito de todo lo que sigue aquí.
2. **No hay identidad.** El perfil es nombre y alias guardados en `settings`, sin
   correo, sin contraseña, sin unicidad. Dos personas pueden ser `@gus`. Un reto
   público necesita, como mínimo, alias únicos y una cuenta que sobreviva a reinstalar.
3. **Un reto público es contenido generado por usuarios visible para desconocidos.** El
   nombre de un reto escrito por cualquiera y mostrado a cualquiera obliga a moderación,
   reporte y bloqueo antes de salir a la tienda (App Store 1.2, Play UGC). No es una
   opinión de diseño: sin eso, la app se rechaza.
4. **Los desconocidos traen acoso.** El empujón del ADR-0027 es un mensaje con remitente
   que llega al teléfono de otro. Entre amigos es motivación; abierto a desconocidos es
   un canal de hostigamiento con nuestra marca encima.

Y dos principios que el ADR-0021 puso y que este reabre: "personas, no seguidores; sin
perfiles públicos ni búsqueda de gente" (principio 1) y "sin ranking … sin porcentajes
contra el grupo" (principio 3).

## Análisis

El deseo detrás del pedido es legítimo y vale más que la letra del ADR-0021: **que
unirse a algo más grande que tú sostenga el hábito, y que la app se conozca**. Un reto
con 300 personas motiva de un modo que un reto con Ana y Luis no. Ese es el fondo.

La pregunta de diseño es dónde se pone el límite, porque "público" tiene tres grados muy
distintos y solo uno de ellos obliga a construir una red social:

- **Público de catálogo**: un directorio dentro de la app donde cualquiera publica un
  reto y cualquiera lo encuentra. Es UGC abierto, necesita moderación, reporte, bloqueo
  y un equipo que responda. Es también donde nacen el feed y el ranking, porque un
  catálogo se ordena por algo y lo único que hay para ordenar es popularidad.
- **Público por link**: el reto es abierto, pero no se descubre dentro de la app. Se
  reparte como se reparte hoy el código del círculo: por WhatsApp, por historia, por la
  tarjeta del ADR-0030. Quien tiene el link entra. No hay directorio que moderar y el
  crecimiento es exactamente el que busca el dueño.
- **Público curado**: retos que publicamos nosotros, uno o dos a la vez ("Septiembre sin
  teléfono en la mesa"). Cualquiera se une, nadie publica. No hay UGC de terceros, así
  que no hay catálogo que moderar, y sí hay algo más grande que tú.

Sobre lo que se ve de los demás, hay una línea que conviene no cruzar aunque el reto sea
público: **en un reto de 300 personas, mostrar a las 300 obliga a ordenarlas**, y ahí
aparece el ranking que la regla 11 prohíbe. La alternativa que sí funciona y no es un
tablero es la que ya usa la app: **ves tu semana, y ves a la gente que conoces dentro de
ese reto**. El tamaño del grupo se dice con un número quieto, sin posiciones.

## Decisión propuesta

**Sí a los retos públicos, en dos formas, y no al directorio de UGC.**

### 1. Prerrequisito: el backend (ADR-0033, por escribir)

Nada de lo de abajo se implementa antes de ese ADR. Tiene que decidir servidor,
identidad (cuenta real o alias único que sobreviva a reinstalar), sincronía de
`member_weeks` y `challenge_marks`, entrega de push, borrado de cuenta y qué se guarda
fuera del teléfono. La regla 7 se enmienda allí, no aquí.

### 2. Reto abierto por link (lo que hace el usuario)

- Al crear un reto, un interruptor: **"Abierto con link"**. Genera un código y un link
  con la misma forma que la invitación al círculo (`vesper://challenge/join?code=…`,
  `https` cuando haya dominio) y el mismo QR.
- **Entrar por link no te mete en el círculo de nadie.** Son dos cosas distintas: el
  círculo son hasta 12 personas que aceptaste; un reto abierto es gente que comparte una
  promesa contigo y nada más. No ven tus horas de foco, no ven tus otros retos, no
  pueden empujarte.
- **El empujón sigue siendo solo del círculo.** Es la regla que impide que esto se
  convierta en un canal de acoso, y no tiene excepción.
- **Cupo**: 100 personas por reto. Un número que permite "algo grande" y mantiene el
  costo y el abuso acotados.
- **Lo que ves dentro**: tu semana, y las semanas de la gente de tu círculo que también
  esté en ese reto. De los demás, un número quieto: "143 personas en este reto". Sin
  lista, sin orden, sin porcentajes contra el grupo.
- **El creador puede cerrar el reto** (deja de aceptar entradas) y salir; quien entró se
  queda con su hábito, como hoy.

### 3. Retos destacados, curados por nosotros

- Una lista corta —uno o dos a la vez— que llega del servidor con nombre, veces por
  semana y duración. Aparece en "Nuevo reto" y como estado vacío del círculo.
- No es un directorio: no se busca, no se publica, no se ordena por popularidad. Es
  contenido nuestro, así que no abre la puerta de la moderación de terceros.
- Mismo trato que cualquier reto: ocupa un hábito (regla 4) y tus marcas son tus marcas.

### 4. Lo que hace falta aunque no haya catálogo

- **Reportar y bloquear**: el nombre de un reto abierto lo escribió alguien. Hace falta
  reportar el reto y bloquear a una persona (que deja de verte y de aparecerte), en el
  backend y en la UI, antes de que esto salga a la tienda.
- **Alias únicos**: dos `@gus` en el mismo reto es confusión y suplantación.
- **Menores y privacidad**: el aviso de privacidad cambia el día que una marca sale del
  teléfono. Lo define el ADR del backend.

### 5. Lo que este ADR rechaza

- **Directorio público buscable de retos de usuarios.** Es el feed y el ranking por la
  puerta de atrás, y un compromiso de moderación permanente. Si más adelante se quiere,
  se escribe con los ojos abiertos: catálogo, reportes, equipo y política.
- **Lista completa de participantes y posiciones.** Regla 11.
- **Empujones entre desconocidos.** Punto 2.

### 6. Lo que cambia en las reglas, si se acepta

- Regla 11 y ADR-0021 principio 1 quedan enmendados: además del círculo por invitación,
  existe el reto abierto por link, sin perfiles públicos, sin búsqueda de gente y sin
  lista de participantes.
- El ADR-0021 sigue mandando en todo lo demás: sin feed, sin ranking, lo que compartes
  lo eliges tú, y el círculo sigue siendo de 12.

## Orden de trabajo propuesto

1. **Ahora**: lo local del ADR-0031 (riesgo, avisos, pantalla del reto, señal en Focus).
   No depende de nada de esto y hace útil el módulo hoy.
2. **Después**: ADR-0033, el backend y la identidad.
3. **Luego**: este ADR, en el orden 3 → 2 (primero los destacados, que son nuestros y no
   necesitan moderación de terceros; después el link abierto con reporte y bloqueo).

## Consecuencias

- Vesper deja de ser estrictamente local-first el día que esto exista: habrá datos de
  una persona en un servidor. El ADR del backend tiene que decir cuáles, por cuánto
  tiempo y cómo se borran.
- Aparece trabajo que hoy no existe: cuenta, reporte, bloqueo, política de privacidad y
  soporte. Es el costo real de "público", y conviene decidirlo con el número delante.
- El crecimiento que busca el dueño viene del link y de la tarjeta del ADR-0030, no del
  catálogo. Esa es la apuesta de este ADR.
