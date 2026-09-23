/**
 * The invite page's whole behaviour (ADR-0034): read the code out of the URL, show it,
 * point the button at the app's own scheme, and say it in the phone's language.
 *
 * It never calls the server. Asking whether a code exists would tell a stranger who it
 * belongs to, and the page has nothing to gain from knowing.
 *
 * Nothing else is called either: the font is served from this domain (style.css), so the
 * footer's promise is something the network tab can check.
 */
(function () {
  const STRINGS = {
    es: {
      title: 'Te invitaron a un círculo',
      body: 'Un círculo son hasta doce personas que eliges. Se ven las horas de foco de la semana, se dan ánimo y hacen retos juntos.',
      open: 'Abrir Vesper',
      openHint: 'Si tienes Vesper en este teléfono, el botón la abre con el código adentro.',
      noAppTitle: '¿No tienes Vesper?',
      noAppBody:
        'Es una app de foco: bloquea lo que te distrae mientras trabajas y te devuelve el tiempo. No pide cuenta ni correo, y todo se queda en tu teléfono.',
      noAppSoon: 'Todavía no está en las tiendas. Guarda este código: te va a servir el día que la instales.',
      privacy: 'Esta página no guarda nada, no usa cookies y no carga nada de otro sitio. El código viaja en el link y no sale de aquí.',
      noCodeTitle: 'Este link no trae un código',
      noCodeBody: 'Pídele a quien te invitó que comparta la invitación otra vez desde Vesper.',
    },
    en: {
      title: 'You have been invited to a circle',
      body: 'A circle is up to twelve people you choose. You see each other’s focus hours for the week, cheer each other on and run challenges together.',
      open: 'Open Vesper',
      openHint: 'If Vesper is on this phone, the button opens it with the code inside.',
      noAppTitle: 'You don’t have Vesper?',
      noAppBody:
        'It is a focus app: it blocks what distracts you while you work and gives the time back. No account, no email, and everything stays on your phone.',
      noAppSoon: 'It is not in the stores yet. Keep this code: it will work the day you install it.',
      privacy: 'This page stores nothing, uses no cookies and loads nothing from anywhere else. The code travels in the link and goes no further.',
      noCodeTitle: 'This link carries no code',
      noCodeBody: 'Ask whoever invited you to share the invitation again from Vesper.',
    },
  };

  /** Six symbols, no 0, O, 1 or I: the same alphabet domain/circle.ts writes. */
  const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

  function dictionary() {
    const tag = (navigator.language || 'es').toLowerCase();
    return tag.indexOf('en') === 0 ? STRINGS.en : STRINGS.es;
  }

  function codeFromLocation() {
    const match = /[?&]code=([A-Za-z0-9]{6})(?![A-Za-z0-9])/.exec(window.location.search);
    if (match === null) {
      return null;
    }
    const code = match[1].toUpperCase();
    return CODE_PATTERN.test(code) ? code : null;
  }

  const t = dictionary();
  const code = codeFromLocation();

  document.documentElement.lang = t === STRINGS.en ? 'en' : 'es';

  Object.keys(t).forEach(function (key) {
    const node = document.querySelector('[data-t="' + key + '"]');
    if (node !== null) {
      node.textContent = t[key];
    }
  });

  const codeNode = document.getElementById('code');
  const openNode = document.getElementById('open');

  if (code === null) {
    // A forwarded link that lost its query, or one typed by hand: say so plainly
    // instead of offering a button that would open the app on nothing.
    document.querySelector('[data-t="title"]').textContent = t.noCodeTitle;
    document.querySelector('[data-t="body"]').textContent = t.noCodeBody;
    codeNode.parentNode.removeChild(codeNode);
    openNode.parentNode.removeChild(openNode);
    document.querySelector('[data-t="openHint"]').textContent = '';
    return;
  }

  codeNode.textContent = code;
  openNode.setAttribute('href', 'vesper://circle/join?code=' + code);
  document.title = code + ' · Vesper';
})();
