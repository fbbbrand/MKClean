document.addEventListener('DOMContentLoaded', function () {

  // ──────────────────────────────────────────
  // Mobile menu — full screen overlay
  // ──────────────────────────────────────────
  var mobileMenu  = document.getElementById('mobile-menu');
  var openBtn     = document.getElementById('menu-open-btn');
  var closeBtn    = document.getElementById('menu-close-btn');
  var mobileLinks = document.querySelectorAll('.mobile-link');

  function openMenu() {
    mobileMenu.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    mobileMenu.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (openBtn)  openBtn.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  mobileLinks.forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  // ──────────────────────────────────────────
  // Smooth scroll
  // ──────────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var id = this.getAttribute('href');
      if (id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var offset = 72; // header height
      var top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });

  // Active nav link highlight on scroll
  var sections = document.querySelectorAll('section[id]');
  var navLinks = document.querySelectorAll('#desktop-nav .nav-item');

  function setActive(id) {
    navLinks.forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('href') === '#' + id);
    });
  }

  function onScroll() {
    var scrollY = window.scrollY + 100;
    var current = sections[0].id;
    sections.forEach(function (section) {
      if (scrollY >= section.offsetTop) current = section.id;
    });
    setActive(current);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ──────────────────────────────────────────
  // Carousel
  // ──────────────────────────────────────────
  function initCarousel() {
    var inner      = document.querySelector('.carousel-inner');
    var items      = document.querySelectorAll('.carousel-item');
    var prevBtn    = document.querySelector('.carousel-prev');
    var nextBtn    = document.querySelector('.carousel-next');
    var indicators = document.querySelectorAll('.carousel-indicator');

    if (!inner || !prevBtn) return;

    var current = 0;
    var total   = items.length;

    function goTo(i) {
      if (i < 0)      i = total - 1;
      if (i >= total) i = 0;
      inner.style.transform = 'translateX(-' + (i * 100) + '%)';
      current = i;
      indicators.forEach(function (dot, idx) {
        dot.classList.toggle('active', idx === i);
      });
    }

    prevBtn.addEventListener('click', function () { goTo(current - 1); });
    nextBtn.addEventListener('click', function () { goTo(current + 1); });

    indicators.forEach(function (dot, idx) {
      dot.addEventListener('click', function () { goTo(idx); });
    });

    var timer = setInterval(function () { goTo(current + 1); }, 5000);

    var carousel = document.querySelector('.carousel');
    carousel.addEventListener('mouseenter', function () { clearInterval(timer); });
    carousel.addEventListener('mouseleave', function () {
      timer = setInterval(function () { goTo(current + 1); }, 5000);
    });

    goTo(0);
  }

  initCarousel();

});
