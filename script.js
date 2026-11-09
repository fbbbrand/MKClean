(function () {
  'use strict';

  // ── Menu mobile ─────────────────────────────
  var nav = document.getElementById('nav');
  var menuBtn = document.getElementById('menu-btn');
  if (nav && menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // ── Carrousel ───────────────────────────────
  // Les photos sont lues depuis data/carousel.json, modifié via la page admin.
  var root = document.getElementById('carousel');
  if (!root) return;

  var ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  var ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function showMessage(msg) {
    root.innerHTML = '';
    root.appendChild(el('div', 'carousel-empty', msg));
  }

  function build(slides) {
    if (!slides.length) { showMessage('Aucune photo pour le moment.'); return; }

    root.innerHTML = '';
    var frame = el('div', 'carousel');
    var viewport = el('div', 'carousel-viewport');
    var track = el('div', 'carousel-track');

    slides.forEach(function (s, i) {
      var fig = el('figure', 'carousel-slide');
      fig.setAttribute('role', 'group');
      fig.setAttribute('aria-label', (i + 1) + ' sur ' + slides.length);
      var img = el('img');
      img.src = s.src;
      img.alt = s.alt || s.title || '';
      if (i > 0) img.loading = 'lazy';
      fig.appendChild(img);
      track.appendChild(fig);
    });

    viewport.appendChild(track);
    frame.appendChild(viewport);

    var bar = el('div', 'carousel-bar');
    var text = el('div', 'carousel-text');
    var title = el('div', 'carousel-title');
    var caption = el('div', 'carousel-caption');
    text.appendChild(title);
    text.appendChild(caption);
    text.setAttribute('aria-live', 'polite');

    var navBox = el('div', 'carousel-nav');
    var count = el('span', 'carousel-count');
    var prev = el('button', 'carousel-btn'); prev.type = 'button'; prev.innerHTML = ICON_PREV; prev.setAttribute('aria-label', 'Photo précédente');
    var next = el('button', 'carousel-btn'); next.type = 'button'; next.innerHTML = ICON_NEXT; next.setAttribute('aria-label', 'Photo suivante');
    navBox.appendChild(count);
    navBox.appendChild(prev);
    navBox.appendChild(next);

    bar.appendChild(text);
    bar.appendChild(navBox);
    root.appendChild(frame);
    root.appendChild(bar);

    var current = 0;
    var total = slides.length;

    function goTo(i) {
      current = (i + total) % total;
      track.style.transform = 'translateX(-' + (current * 100) + '%)';
      title.textContent = slides[current].title || '';
      caption.textContent = slides[current].caption || '';
      count.textContent = (current + 1) + ' / ' + total;
    }

    prev.addEventListener('click', function () { goTo(current - 1); restart(); });
    next.addEventListener('click', function () { goTo(current + 1); restart(); });

    // Glisser au doigt sur mobile
    var startX = null;
    viewport.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    viewport.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) { goTo(current + (dx < 0 ? 1 : -1)); restart(); }
      startX = null;
    });

    // Défilement auto, coupé si l'utilisateur préfère moins d'animations
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var timer = null;
    function start() { if (!reduce && total > 1) timer = setInterval(function () { goTo(current + 1); }, 6000); }
    function stop() { clearInterval(timer); timer = null; }
    function restart() { stop(); start(); }
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);

    goTo(0);
    start();
  }

  fetch('data/carousel.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) { build(Array.isArray(data.slides) ? data.slides : []); })
    .catch(function () { showMessage('Les photos n\'ont pas pu être chargées.'); });
})();
