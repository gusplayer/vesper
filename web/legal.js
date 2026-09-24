/**
 * Terms and Privacy carry both languages in the page (ADR-0046): a legal text that is
 * only half there when JavaScript fails is worse than one that is twice there. So the
 * markup ships Spanish and English, and this file's only job is to hide the one the
 * reader did not ask for and offer the other in a line.
 *
 * Which one: `?lang=es|en` if the link carried it —that is what a store reviewer or a
 * lawyer gets sent— then a Spanish path (`/privacidad`, `/terminos`), then the browser's
 * own language, like invite.js. Nothing else is read and nothing is stored: no cookie,
 * no localStorage, no request. Without this file both languages simply stay visible.
 */
(function () {
  const OTHER = { es: 'English', en: 'Español' };

  function wanted() {
    const asked = /[?&]lang=(es|en)\b/.exec(window.location.search);
    if (asked !== null) {
      return asked[1];
    }
    if (/privacidad|terminos/.test(window.location.pathname)) {
      return 'es';
    }
    return (navigator.language || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es';
  }

  function show(lang) {
    const sections = document.querySelectorAll('main > section[lang]');
    if (sections.length < 2) {
      return;
    }
    Array.prototype.forEach.call(sections, function (section) {
      section.hidden = section.getAttribute('lang') !== lang;
    });
    // The rule separates the two languages; with one of them gone it separates nothing.
    Array.prototype.forEach.call(document.querySelectorAll('main > hr.rule'), function (rule) {
      rule.hidden = true;
    });
    // One page links to the other: it carries the language across, so a reader sent the
    // English terms does not land on the Spanish privacy page because of their browser.
    Array.prototype.forEach.call(document.querySelectorAll('main a[href^="/terms"], main a[href^="/privacy"]'), function (link) {
      link.setAttribute('href', link.getAttribute('href').split('?')[0] + '?lang=' + lang);
    });
    document.documentElement.lang = lang;
    // The tab said "Privacidad" while the page said "Privacy". The heading on screen is
    // the one thing that is always right, so the title comes from it.
    const heading = document.querySelector('main > section[lang="' + lang + '"] h1');
    if (heading !== null) {
      document.title = heading.textContent + ' · Vesper';
    }
  }

  const start = wanted();
  show(start);

  // The switch is added here, not in the markup: without JavaScript both languages are
  // already on the page and a link that changes nothing would be a lie.
  let current = start;
  const link = document.createElement('a');
  link.className = 'switch';
  link.setAttribute('href', '?lang=' + (current === 'es' ? 'en' : 'es'));
  link.textContent = OTHER[current];
  link.addEventListener('click', function (event) {
    event.preventDefault();
    current = current === 'es' ? 'en' : 'es';
    show(current);
    link.textContent = OTHER[current];
    link.setAttribute('href', '?lang=' + (current === 'es' ? 'en' : 'es'));
    // Keeps the address shareable in the language on screen, without a page load.
    window.history.replaceState(null, '', '?lang=' + current);
    window.scrollTo(0, 0);
  });
  const main = document.querySelector('main');
  if (main !== null) {
    main.appendChild(link);
  }
})();
